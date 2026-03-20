import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Settings, Printer, FileImage, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { processFileToZPL } from './lib/zpl';
import { Language, useTranslation } from './lib/i18n';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zplData, setZplData] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const defaultHost = import.meta.env.VITE_PRINTER_HOST || '';
  const defaultPort = import.meta.env.VITE_PRINTER_PORT || '9100';

  const [showSettings, setShowSettings] = useState(false);
  const [printerHost, setPrinterHost] = useState(localStorage.getItem('printerHost') || defaultHost);
  const [printerPort, setPrinterPort] = useState(localStorage.getItem('printerPort') || defaultPort);
  const [language, setLanguage] = useState<Language>((localStorage.getItem('language') as Language) || 'en');
  
  const t = useTranslation(language);

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedHost = localStorage.getItem('printerHost');
    const savedPort = localStorage.getItem('printerPort');
    const savedLang = localStorage.getItem('language') as Language;
    if (savedHost) setPrinterHost(savedHost);
    if (savedPort) setPrinterPort(savedPort);
    if (savedLang) setLanguage(savedLang);
    
    // Force settings open if no host is configured at all
    if (!savedHost && !defaultHost) {
      setShowSettings(true);
    }
  }, [defaultHost]);

  const testAndSaveSettings = async () => {
    if (!printerHost) {
      setTestResult({ type: 'error', message: t('enterHost') });
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const response = await fetch('api/test-printer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: printerHost, port: parseInt(printerPort, 10) })
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({ type: 'success', message: t('connSuccess') });
        localStorage.setItem('printerHost', printerHost);
        localStorage.setItem('printerPort', printerPort);
        localStorage.setItem('language', language);
        setTimeout(() => {
          setShowSettings(false);
          setTestResult(null);
        }, 1500);
      } else {
        setTestResult({ type: 'error', message: data.error || t('connFailed') });
      }
    } catch (error: any) {
      setTestResult({ type: 'error', message: `${t('error')}: ${error.message}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setPrintStatus(null);
    setPreviewUrl(null);
    setZplData(null);

    try {
      const { zpl, previewUrl } = await processFileToZPL(selectedFile);
      setZplData(zpl);
      setPreviewUrl(previewUrl);
    } catch (error: any) {
      console.error('Error processing file:', error);
      setPrintStatus({ type: 'error', message: `${t('processError')}: ${error.message}` });
    } finally {
      setIsProcessing(false);
    }
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    maxFiles: 1
  } as any);

  const handlePrint = async () => {
    if (!zplData) return;
    
    setIsPrinting(true);
    setPrintStatus(null);

    try {
      // Gebruik een relatief pad ('api/print' in plaats van '/api/print') 
      // zodat het correct werkt als de app in een submap draait.
      const response = await fetch('api/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host: printerHost,
          port: parseInt(printerPort, 10),
          zpl: zplData
        })
      });

      const data = await response.json();

      if (response.ok) {
        setPrintStatus({ type: 'success', message: t('printSuccess') });
      } else {
        throw new Error(data.error || t('unknownError'));
      }
    } catch (error: any) {
      setPrintStatus({ type: 'error', message: `${t('printError')}: ${error.message}` });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* App Bar */}
      <header className="bg-blue-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-6 h-6" />
            <h1 className="text-xl font-semibold tracking-wide">{t('title')}</h1>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-blue-700 rounded-full transition-colors"
            title={t('settings')}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        
        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-medium mb-4">{t('selectFile')}</h2>
          
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-2 text-gray-400">
                <FileText className="w-8 h-8" />
                <FileImage className="w-8 h-8" />
              </div>
              {isDragActive ? (
                <p className="text-blue-600 font-medium">{t('dropFile')}</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-gray-700 font-medium">{t('dragDrop')}</p>
                  <p className="text-sm text-gray-500">{t('supportedFiles')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
            <p>{t('processing')}</p>
          </div>
        )}

        {/* Preview & Print Card */}
        {previewUrl && !isProcessing && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <h2 className="text-lg font-medium mb-4">{t('preview')}</h2>
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center border border-gray-200">
                <img 
                  src={previewUrl} 
                  alt="Label Preview" 
                  className="max-h-[400px] shadow-sm border border-gray-300 bg-white"
                />
              </div>
            </div>
            
            <div className="w-full md:w-64 flex flex-col justify-center space-y-4">
              <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-lg border border-blue-100">
                <p className="font-medium">{t('printerTarget')}</p>
                <p className="truncate" title={printerHost}>{printerHost}:{printerPort}</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  {isPrinting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('printing')}
                    </>
                  ) : (
                    <>
                      <Printer className="w-5 h-5" />
                      {t('print')}
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    const blob = new Blob([zplData], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'label.zpl';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  {t('downloadZpl')}
                </button>
              </div>

              {printStatus && (
                <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
                  printStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {printStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                  <p>{printStatus.message}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-medium">{t('printerSettings')}</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('printerIp')}</label>
                <input 
                  type="text" 
                  value={printerHost}
                  onChange={(e) => setPrinterHost(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder={t('printerIpPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('printerPort')}</label>
                <input 
                  type="number" 
                  value={printerPort}
                  onChange={(e) => setPrinterPort(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="9100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  <option value="en">English</option>
                  <option value="nl">Nederlands</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
            {testResult && (
              <div className={`px-6 py-3 text-sm ${testResult.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {testResult.message}
              </div>
            )}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              {(localStorage.getItem('printerHost') || defaultHost) && (
                <button 
                  onClick={() => setShowSettings(false)}
                  disabled={isTestingConnection}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
              )}
              <button 
                onClick={testAndSaveSettings}
                disabled={isTestingConnection}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isTestingConnection ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('testing')}</>
                ) : (
                  t('testAndSave')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
