import React, { useState, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { 
  Camera, 
  Image as ImageIcon, 
  UploadCloud, 
  RefreshCw, 
  X, 
  AlertCircle, 
  CheckCircle,
  Check,
  FileText
} from "lucide-react";
import { ScannedReceiptResult } from "../types";
import { saveOcrErrorLog } from "../utils";

interface QueueItem {
  id: string;
  name: string;
  file: File;
  previewUrl: string;
  status: 'queued' | 'scanning' | 'success' | 'failed' | 'duplicate';
  stepMsg: string;
  errorMsg?: string;
}

interface ReceiptScannerProps {
  onScanSuccess: (data: ScannedReceiptResult, isPartOfBatch?: boolean) => void;
  existingInvoices: string[];
  onBatchComplete?: () => void;
  language?: "en" | "pt";
}

export interface ReceiptScannerRef {
  triggerChooseFile: () => void;
  triggerTakePhoto: () => void;
}

const ReceiptScanner = forwardRef<ReceiptScannerRef, ReceiptScannerProps>(({ onScanSuccess, existingInvoices, onBatchComplete, language }, ref) => {
  const [error, setError] = useState<string | null>(null);

  // Queue of images to be processed
  const [queue, setQueue] = useState<QueueItem[]>([]);

  // Derived state to show batch metrics
  const completedCount = useMemo(() => queue.filter(q => q.status === 'success').length, [queue]);
  const failedCount = useMemo(() => queue.filter(q => q.status === 'failed').length, [queue]);
  const duplicateCount = useMemo(() => queue.filter(q => q.status === 'duplicate').length, [queue]);
  const scanningCount = useMemo(() => queue.filter(q => q.status === 'scanning').length, [queue]);
  const totalCount = queue.length;
  const isFinished = totalCount > 0 && queue.every(q => q.status === 'success' || q.status === 'failed' || q.status === 'duplicate');

  // Automatically switch tab to review when batch scanning is complete and successful
  useEffect(() => {
    if (isFinished && onBatchComplete) {
      if (completedCount > 0) {
        const timer = setTimeout(() => {
          onBatchComplete();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isFinished, completedCount, onBatchComplete]);

  // Webcam states
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup effect
  useEffect(() => {
    return () => {
      stopCamera();
      // Revoke any created object URLs to prevent leaks
      queue.forEach(item => {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch (e) {}
      });
    };
  }, []);

  // Add files to the processing queue
  const addFilesToQueue = (files: File[]) => {
    setError(null);
    const validFiles = files.filter(f => f.type.startsWith("image/"));
    if (validFiles.length === 0) {
      setError(language === 'pt' ? "Por favor, selecione arquivos de imagem válidos (PNG, JPG, JPEG, WEBP)." : "Please select valid image files (PNG, JPG, JPEG, WEBP).");
      return;
    }

    const newItems: QueueItem[] = validFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
      stepMsg: language === 'pt' ? 'Aguardando na fila...' : 'Waiting in queue...',
    }));

    setQueue(prev => [...prev, ...newItems]);
  };

  // Run queue sequentially
  useEffect(() => {
    // Check if there is any item currently 'scanning'
    const isAnyScanning = queue.some(item => item.status === 'scanning');
    if (isAnyScanning) return;

    // Find the first 'queued' item
    const nextItem = queue.find(item => item.status === 'queued');
    if (!nextItem) return;

    // Process the next item
    processQueueItem(nextItem);
  }, [queue]);

  // Execute queue item process
  const processQueueItem = async (item: QueueItem) => {
    // Mark item as scanning
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'scanning', stepMsg: language === 'pt' ? 'Preparando imagem...' : 'Preparing image payload...' } : q));

    // Convert File to Base64 & attempt automatic parsing
    const fileReaderPromise = new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(language === 'pt' ? "Falha ao ler o arquivo. Tente novamente." : "Failed to read the file. Please try again."));
      reader.readAsDataURL(item.file);
    });

    try {
      const base64String = await fileReaderPromise;
      await runReceiptScanForQueue(item.id, base64String, item.file.type, item.name);
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.message || (language === 'pt' ? "Falha ao processar imagem do recibo." : "Failed to process receipt image.");
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'failed', errorMsg } : q));
      saveOcrErrorLog(item.name, errorMsg);
    }
  };

  // Standard OCR scan queue helper
  const runReceiptScanForQueue = async (itemId: string, base64WithPrefix: string, mimeType: string, fileName: string) => {
    const base64Data = base64WithPrefix.split(",")[1];
    
    // Setup initial scanning messaging
    setQueue(prev => prev.map(q => q.id === itemId ? { 
      ...q, 
      stepMsg: language === 'pt' ? "Enviando recibo para análise..." : "Sending receipt to receipt scan analyzer..." 
    } : q));

    const stepInterval = setInterval(() => {
      setQueue(prev => prev.map(q => {
        if (q.id !== itemId) return q;
        let nextStep = q.stepMsg;
        if (nextStep.includes("Sending") || nextStep.includes("Enviando")) {
          nextStep = language === 'pt' ? "Buscando e registrando o Número da Nota..." : "Searching for and registering the Invoice Number...";
        } else if (nextStep.includes("Searching") || nextStep.includes("Buscando")) {
          nextStep = language === 'pt' ? "IA Gemini realizando escaneamento OCR inteligente..." : "Gemini AI is performing smart OCR scanning...";
        } else if (nextStep.includes("Gemini") || nextStep.includes("IA Gemini")) {
          nextStep = language === 'pt' ? "Extraindo itens comprados, quantidades e preços..." : "Extracting purchased items, quantities, and prices...";
        } else if (nextStep.includes("Extracting") || nextStep.includes("Extraindo")) {
          nextStep = language === 'pt' ? "Classificando itens de mercado em categorias..." : "Classifying grocery items into categories...";
        } else {
          nextStep = language === 'pt' ? "Montando linhas da planilha..." : "Assembling spreadsheet database rows...";
        }
        return { ...q, stepMsg: nextStep };
      }));
    }, 1500);

    try {
      const response = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: mimeType,
          existingInvoices,
        }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to scan receipt image.");
      }

      const receiptResult: ScannedReceiptResult = await response.json();
      
      const normalizedScannedInvoiceNum = receiptResult.invoiceNumber?.trim() || "";
      const isClientDuplicate = normalizedScannedInvoiceNum !== "" && existingInvoices.some(
        (inv: string) => inv.trim().toLowerCase() === normalizedScannedInvoiceNum.toLowerCase()
      );

      if (receiptResult.isDuplicate || isClientDuplicate) {
        setQueue(prev => prev.map(q => q.id === itemId ? { 
          ...q, 
          status: 'duplicate', 
          stepMsg: `Duplicate skipped (Invoice #${normalizedScannedInvoiceNum || "N/A"})`,
          errorMsg: normalizedScannedInvoiceNum || "N/A"
        } : q));
        return;
      }
      
      // Call parent handleScanSuccess with batch mode true to prevent immediate unmounting
      onScanSuccess(receiptResult, true);

      setQueue(prev => prev.map(q => q.id === itemId ? { 
        ...q, 
        status: 'success', 
        stepMsg: `Imported ${receiptResult.items?.length || 0} items successfully!` 
      } : q));
    } catch (err: any) {
      clearInterval(stepInterval);
      const errorMsg = err.message || "Failed to parse receipt image details.";
      setQueue(prev => prev.map(q => q.id === itemId ? { 
        ...q, 
        status: 'failed', 
        errorMsg: errorMsg
      } : q));
      saveOcrErrorLog(fileName, errorMsg);
    }
  };

  // Start Camera
  const startCamera = async () => {
    try {
      setError(null);
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setError("Unable to access camera or webcam mode. Please upload a file instead.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  // Convert captured base64 data into a standard File, then queue it
  const addBase64PhotoToQueue = async (base64WithPrefix: string, filename: string) => {
    try {
      const parts = base64WithPrefix.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while(n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const file = new File([u8arr], filename, { type: mime });
      addFilesToQueue([file]);
    } catch (e) {
      console.error(e);
      setError("Failed to convert camera photograph.");
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      // Set canvas dimensions to the exact natural video resolution to capture the frame precisely 1:1 without cropping
      const videoWidth = videoRef.current.videoWidth || 640;
      const videoHeight = videoRef.current.videoHeight || 480;
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL("image/jpeg");
        stopCamera();
        
        await addBase64PhotoToQueue(base64Data, `webcam_snap_${Date.now()}.jpg`);
      }
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
  };

  const resetScanner = () => {
    queue.forEach(item => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch (e) {}
    });
    setQueue([]);
    setError(null);
    stopCamera();
  };

  // Derived metrics are placed at top level for proper lexical scoping

  useImperativeHandle(ref, () => ({
    triggerChooseFile: onUploadClick,
    triggerTakePhoto: onCameraClick
  }));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      
      {/* Header */}
      <div className="border-b border-slate-100 pb-4 mb-5">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
          <Camera className="w-5 h-5 text-emerald-500" />
          {language === 'pt' ? 'Central de Digitalização de Recibos' : 'Receipt Scan Center'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'pt' 
            ? 'Capture via webcam ou envie múltiplos recibos para preencher o banco de dados de compras automaticamente!' 
            : 'Capture via webcam or upload multiple receipts to populate the grocery database automatically!'}
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{language === 'pt' ? 'Mensagem do Sistema do Scanner' : 'Scanner System Message'}</p>
            <p className="mt-0.5 text-rose-600 leading-normal">{error}</p>
          </div>
        </div>
      )}

      {/* Webcam full screen overlay */}
      {showCamera && (
        <div id="camera-fullscreen-overlay" className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 select-none animate-fade-in">
          {/* Header instructions bar */}
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
            <div className="flex flex-col">
              <span className="text-white font-bold text-base tracking-tight flex items-center gap-1.5">
                <Camera className="w-5 h-5 text-emerald-400" />
                Live Receipt Scanner
              </span>
              <span className="text-slate-400 text-xs mt-0.5">Align your paper grocery receipt within the viewport target</span>
            </div>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white p-2.5 rounded-xl border border-slate-800/80 transition-all cursor-pointer shadow-md"
              aria-label="Close camera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Central Live Video Aspect Preserved Area */}
          <div className="flex-1 w-full max-w-4xl mx-auto flex items-center justify-center relative my-4">
            <div className="relative w-full h-full max-h-[68vh] flex items-center justify-center">
              {/* Dynamic object-contain guarantees exact uncropped source video aspect matches user display */}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="max-w-full max-h-full rounded-2xl border border-slate-800 shadow-2xl bg-black object-contain"
              />
              
              {/* Centered Guide Rectangle overlay to assist receipt alignment */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                <div className="w-60 sm:w-72 h-80 sm:h-96 max-h-[85%] border-2 border-dashed border-emerald-400/60 rounded-2xl relative flex items-center justify-center bg-emerald-500/5 shadow-inner">
                  {/* Styling beautiful target camera corners */}
                  <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>
                  
                  <div className="text-center px-4 bg-slate-950/80 rounded-lg p-2 border border-slate-800 pointer-events-none select-none">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                      Align Bill
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5 block normal-case">
                      Same aspect captured
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Camera Buttons Footer */}
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-full p-4.5 shadow-xl flex items-center justify-center transition-all cursor-pointer border-4 border-emerald-500/35 group"
                id="camera-capture-trigger"
                title="Capture Receipt"
              >
                <Camera className="w-7 h-7 text-white group-hover:scale-105 transition-transform" /> 
              </button>
            </div>
            
            <button
              type="button"
              onClick={stopCamera}
              className="text-slate-400 hover:text-white text-xs font-semibold px-4 py-2 hover:bg-slate-900 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop zone (visible when no camera and queue is empty) */}
      {!showCamera && queue.length === 0 && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            isDragging 
              ? "border-emerald-500 bg-emerald-50/30" 
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/10"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            accept="image/*"
            className="hidden"
            multiple
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={onFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <UploadCloud className="w-10 h-10 mx-auto mb-3 text-slate-400" />
          <p className="font-semibold text-slate-800 text-sm">
            {language === 'pt' ? 'Arraste e solte imagens de recibos (Selecione vários de uma vez!)' : 'Drag and drop receipt images (Select multiple at once!)'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {language === 'pt' ? 'Formatos PNG, JPG, JPEG ou WEBP suportados' : 'PNG, JPG, JPEG or WEBP formats supported'}
          </p>
          
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onUploadClick}
              className="bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 hover:border-slate-800 text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              title={language === 'pt' ? 'Escolher fotos diretamente da sua galeria de fotos ou biblioteca' : "Choose photos directly from your phone's photo library or gallery"}
            >
              <ImageIcon className="w-3.5 h-3.5 text-sky-450" /> {language === 'pt' ? 'Escolher da Galeria' : 'Choose from Gallery'}
            </button>
            <button
              type="button"
              onClick={onCameraClick}
              className="bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700 text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              title={language === 'pt' ? 'Tirar uma foto direta usando a câmera nativa de alta resolução do seu dispositivo' : "Take a direct photo using your device's native high-resolution camera"}
            >
              <Camera className="w-3.5 h-3.5" /> {language === 'pt' ? 'Tirar Foto com Celular' : 'Take Phone Photo'}
            </button>
          </div>
        </div>
      )}

      {/* Batch Processing Panel when queue has items */}
      {queue.length > 0 && (
        <div className="p-5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none">
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {language === 'pt' 
                  ? `Processamento em Lote de Recibos (${completedCount} de ${totalCount} concluídos)` 
                  : `Receipt Batch Processing (${completedCount} of ${totalCount} completed)`}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {scanningCount > 0 
                  ? (language === 'pt' ? "Digitalizando recibos sequencialmente para garantir alta precisão de dados..." : "Scanning documents sequentially to ensure high precision data classification...") 
                  : isFinished 
                  ? (language === 'pt' ? "🎉 Lote concluído! Todos os recibos processados com sucesso foram adicionados ao banco de dados." : "🎉 Batch complete! All successfully processed receipts are added to your database.")
                  : (language === 'pt' ? "Processamento em lote ativo..." : "Batch processing active...")}
              </p>
            </div>
            
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={onUploadClick}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                title={language === 'pt' ? "Escolher mais fotos da galeria do seu celular para processar" : "Choose more photos from your phone gallery to process"}
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
                {language === 'pt' ? 'Adicionar da Galeria' : 'Add from Gallery'}
              </button>
              <button
                type="button"
                onClick={onCameraClick}
                className="bg-white border border-slate-200 hover:bg-slate-55 hover:text-rose-600 text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                title={language === 'pt' ? "Tirar uma foto em tempo real usando a câmera para processar" : "Capture a live photo using your phone camera to process"}
              >
                <Camera className="w-3.5 h-3.5 text-emerald-500" />
                {language === 'pt' ? 'Tirar Foto' : 'Add Camera Photo'}
              </button>
              <button
                type="button"
                onClick={resetScanner}
                className="bg-white border border-slate-200 hover:bg-slate-55 hover:text-rose-600 text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                {language === 'pt' ? 'Limpar Fila' : 'Clear Queue'}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-150 dark:bg-slate-850 h-2 rounded-full overflow-hidden mb-5">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${((completedCount + failedCount + duplicateCount) / totalCount) * 100}%` }}
            />
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white dark:bg-slate-900/90 border border-slate-100 dark:border-slate-800/80 p-3.5 rounded-xl mb-4 text-xs font-medium text-slate-500 dark:text-slate-400 select-none">
            <div className="text-center sm:border-r border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase tracking-tight">{language === 'pt' ? 'Na Fila' : 'Queued'}</p>
              <p className="text-base font-extrabold text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                {queue.filter(q => q.status === 'queued').length}
              </p>
            </div>
            <div className="text-center sm:border-r border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase tracking-tight">{language === 'pt' ? 'Analisando' : 'Analyzing'}</p>
              <p className="text-base font-extrabold text-indigo-500 font-mono mt-0.5">
                {scanningCount}
              </p>
            </div>
            <div className="text-center sm:border-r border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase tracking-tight">{language === 'pt' ? 'Sucesso' : 'Success'}</p>
              <p className="text-base font-extrabold text-emerald-500 font-mono mt-0.5">
                {completedCount}
              </p>
            </div>
            <div className="text-center sm:border-r border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase tracking-tight">{language === 'pt' ? 'Duplicados' : 'Duplicate'}</p>
              <p className={`text-base font-extrabold font-mono mt-0.5 ${duplicateCount > 0 ? "text-amber-550" : "text-slate-450"}`}>
                {duplicateCount}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-tight">{language === 'pt' ? 'Falhas' : 'Failed'}</p>
              <p className={`text-base font-extrabold font-mono mt-0.5 ${failedCount > 0 ? "text-rose-500" : "text-slate-400"}`}>
                {failedCount}
              </p>
            </div>
          </div>

          {/* Hidden helper element to load files while in queue panel */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            accept="image/*"
            className="hidden"
            multiple
          />

          {/* Queue Rows */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div 
                key={item.id}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                  item.status === 'scanning'
                    ? 'bg-indigo-50/45 border-indigo-150 dark:bg-indigo-950/20 dark:border-indigo-900/45'
                    : item.status === 'success'
                    ? 'bg-emerald-50/10 border-emerald-100/50'
                    : item.status === 'duplicate'
                    ? 'bg-amber-50/10 border-amber-205/30 dark:bg-amber-950/10 dark:border-amber-900/35'
                    : item.status === 'failed'
                    ? 'bg-rose-50/20 border-rose-150/30'
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-100/80 dark:border-slate-800 bg-white">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400">
                      <FileText className="w-4 h-4 text-slate-405" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-850 dark:text-slate-105 truncate block">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0 select-none">
                      {item.file.size ? `${(item.file.size / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </div>

                  {/* Status description */}
                  <div className="flex items-center gap-1.5 mt-0.5 min-h-[16px]">
                    {item.status === 'scanning' && (
                      <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin shrink-0" />
                    )}
                    <span className={`text-[10.5px] leading-snug truncate block ${
                      item.status === 'scanning'
                        ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                        : item.status === 'success'
                        ? 'text-emerald-605 dark:text-emerald-400 font-medium'
                        : item.status === 'duplicate'
                        ? 'text-amber-600 dark:text-amber-405 font-medium'
                        : item.status === 'failed'
                        ? 'text-rose-600 dark:text-rose-400 font-medium'
                        : 'text-slate-400'
                    }`}>
                      {item.status === 'failed' 
                        ? (item.errorMsg || (language === 'pt' ? "Falha ao escanear o recibo." : "Failed to scan receipt.")) 
                        : item.status === 'duplicate' 
                        ? (language === 'pt' ? `Nota duplicada #${item.errorMsg || 'N/A'}` : `Duplicate invoice #${item.errorMsg || 'N/A'}`) 
                        : item.stepMsg}
                    </span>
                  </div>
                </div>

                {/* Badge Indicator */}
                <div className="shrink-0 pl-1 select-none">
                  {item.status === 'queued' && (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-100 dark:bg-slate-850 text-slate-450 rounded-md">
                      {language === 'pt' ? 'Na Fila' : 'Queued'}
                    </span>
                  )}
                  {item.status === 'scanning' && (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-550 text-white rounded-md animate-pulse">
                      {language === 'pt' ? 'Analisando' : 'Analyzing'}
                    </span>
                  )}
                  {item.status === 'success' && (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500 text-white rounded-md flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> {language === 'pt' ? 'OK' : 'Done'}
                    </span>
                  )}
                  {item.status === 'duplicate' && (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded-md flex items-center gap-0.5">
                      {language === 'pt' ? 'Duplicado' : 'Duplicate'}
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-500 text-white rounded-md flex items-center gap-0.5" title={item.errorMsg}>
                      {language === 'pt' ? 'Falhou' : 'Failed'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Display which duplicates were found at the end of queue processing */}
          {isFinished && duplicateCount > 0 && (
            <div className="mt-4 p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-xl">
              <div className="flex gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                    {language === 'pt' ? 'Recibos Duplicados Detectados e Ignorados' : 'Duplicate Receipts Detected & Skipped'}
                  </h5>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 mb-2.5 leading-relaxed">
                    {language === 'pt' 
                      ? 'Para manter as tabelas de compras limpas e evitar importações redundantes, o scanner pulou automaticamente estas notas fiscais duplicadas:' 
                      : 'To maintain clean grocery spreadsheet tables and avoid redundant imports, the scanner automatically bypassed these duplicate invoice records:'}
                  </p>
                  <div className="bg-white/80 dark:bg-slate-900/85 border border-amber-200/40 dark:border-amber-900/25 rounded-lg overflow-hidden divide-y divide-amber-100/40 dark:divide-amber-900/10">
                    {queue
                      .filter(q => q.status === 'duplicate')
                      .map((item) => (
                        <div key={item.id} className="p-2 md:px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 text-[11px] font-mono">
                          <span className="text-slate-600 dark:text-slate-405 font-medium truncate max-w-[240px] md:max-w-xs" title={item.name}>
                            📄 {item.name}
                          </span>
                          <span className="text-amber-750 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-100/30">
                            {language === 'pt' ? `Nota: #${item.errorMsg || "N/A"}` : `Invoice: #${item.errorMsg || "N/A"}`}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Batch complete footer button trigger to review items */}
          {isFinished && (
            <div className="mt-5 border-t border-slate-150/50 dark:border-slate-800/50 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (onBatchComplete) {
                    onBatchComplete();
                  } else {
                    const event = new CustomEvent("tab-switch", { detail: "staged-review" });
                    window.dispatchEvent(event);
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 animate-pulse"
              >
                {language === 'pt' ? 'Revisar e Importar Itens →' : 'Review and Import Scanned Items →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Guide Note */}
      <div className="mt-5 bg-slate-50 rounded-xl p-3.5 text-[11px] text-slate-600 leading-normal border border-slate-100/50">
        <div>
          <span className="font-bold text-slate-800">💡 {language === 'pt' ? 'Dica Rápida de Escaneamento OCR:' : 'Quick OCR Scan Tip:'}</span> {language === 'pt' ? 'Certifique-se de que o texto do recibo esteja nítido e que os preços/quantidades estejam visíveis.' : 'Ensure the receipt text is clear, and prices/quantities are visible.'} <b>{language === 'pt' ? 'Descontos listados abaixo de itens individuais são detectados e deduzidos automaticamente' : 'Item-split discounts listed below items are automatically detected and deducted'}</b> {language === 'pt' ? 'do preço de cada produto para garantir o valor líquido correto na planilha!' : "from each item's price for an accurate net-total spreadsheet database!"}
        </div>
      </div>
    </div>
  );
});

export default ReceiptScanner;
