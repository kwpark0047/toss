import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tablesAPI, storesAPI } from '../../api';
import { 
  ArrowLeft, Plus, Edit, Trash2, QrCode, RefreshCw, 
  Download, FileText, Loader2, LayoutGrid, List,
  Users, Maximize2, Sparkles, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VisualTableMap from './VisualTableMap';
import { getSocket } from '../../utils/socket';

const TableManager = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [showQrModal, setShowQrModal] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [viewMode, setViewMode] = useState('map'); // 'list' or 'map'

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    if (socket) {
      socket.on('table-updated', (data) => {
        if (data && data.store_id === parseInt(storeId)) {
          fetchData();
        }
      });
    }

    return () => {
      if (socket) socket.off('table-updated');
    };
  }, [storeId]);

  const fetchData = async () => {
    try {
      const [storeRes, tablesRes] = await Promise.all([
        storesAPI.getById(storeId), 
        tablesAPI.getByStore(storeId)
      ]);
      setStore(storeRes.data);
      setTables(tablesRes.data);
    } catch (error) { 
      console.error(error); 
      navigate('/admin'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    try { 
      await tablesAPI.delete(id); 
      fetchData(); 
    } catch (error) { 
      alert(error.response?.data?.error || 'Delete failed'); 
    }
  };

  const handleRegenerateQr = async (id) => {
    if (!window.confirm('Regenerate QR code? The old one will no longer work.')) return;
    try { 
      await tablesAPI.regenerateQr(id); 
      fetchData(); 
    } catch (error) { 
      alert(error.response?.data?.error || 'QR generation failed'); 
    }
  };

  const getQrUrl = (qrCode) => window.location.origin + '/menu/' + qrCode;
  const getQrImageUrl = (qrCode, size = 200) => 
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(getQrUrl(qrCode))}`;

  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

  const generatePDF = async () => {
    if (tables.length === 0) { alert('No tables to export'); return; }
    setPdfLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210, pageHeight = 297, margin = 15, qrSize = 60;
      const cellWidth = (pageWidth - margin * 2) / 2, cellHeight = 90, qrsPerPage = 6;
      
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const positionInPage = i % qrsPerPage;
        const col = positionInPage % 2, row = Math.floor(positionInPage / 2);
        
        if (i > 0 && positionInPage === 0) doc.addPage();
        
        if (positionInPage === 0) {
          doc.setFillColor(15, 23, 42); // slate-900
          doc.rect(0, 0, pageWidth, 25, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.text(store?.name || '', pageWidth / 2, 12, { align: 'center' });
          doc.setFontSize(10);
          doc.text('PREMIUM QR MENU SYSTEM', pageWidth / 2, 20, { align: 'center' });
        }
        
        const x = margin + col * cellWidth, y = 35 + row * cellHeight;
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.5);
        doc.roundedRect(x + 5, y, cellWidth - 10, cellHeight - 5, 5, 5, 'S');
        
        try {
          const img = await loadImage(getQrImageUrl(table.qr_code, 300));
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', x + (cellWidth - qrSize) / 2, y + 8, qrSize, qrSize);
        } catch {
          doc.setTextColor(225, 29, 72); // rose-600
          doc.setFontSize(10);
          doc.text('QR ERROR', x + cellWidth / 2, y + 40, { align: 'center' });
        }
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.text(table.name, x + cellWidth / 2, y + qrSize + 15, { align: 'center' });
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text('SCAN TO ORDER', x + cellWidth / 2, y + qrSize + 22, { align: 'center' });
      }
      
      const totalPages = Math.ceil(tables.length / qrsPerPage);
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8);
        doc.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      doc.save(`${store?.name || 'tables'}_QR_CODES.pdf`);
    } catch { 
      alert('Failed to generate PDF'); 
    } finally { 
      setPdfLoading(false); 
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full mb-4"
        />
        <p className="text-slate-500 font-black text-xs tracking-widest uppercase">Initializing Table Map...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      {/* 헤더 섹션 */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
        <div className="flex items-center gap-6">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <button onClick={() => navigate("/admin")} className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={24} />
            </button>
          </motion.div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
              TABLE MAP
              <Sparkles size={24} className="text-orange-500 animate-pulse" />
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{store?.name} Space Management</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-1 rounded-2xl border border-white/5 flex">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${
                viewMode === 'map' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <LayoutGrid size={14} /> MAP VIEW
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${
                viewMode === 'list' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <List size={14} /> LIST VIEW
            </button>
          </div>
          
          <button 
            onClick={generatePDF} 
            disabled={pdfLoading || tables.length === 0} 
            className="h-14 px-8 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-slate-400 font-black text-[10px] tracking-widest hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
          >
            {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
            GENERATE PDF
          </button>

          <button 
            onClick={() => { setEditingTable(null); setShowModal(true); }} 
            className="h-14 px-8 bg-orange-500 text-white rounded-2xl flex items-center gap-3 font-black text-[10px] tracking-widest shadow-2xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={18} /> ADD TABLE
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <AnimatePresence mode="wait">
        {viewMode === 'map' ? (
          <motion.div
            key="map"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white/5 backdrop-blur-2xl rounded-[3rem] border border-white/5 p-8 min-h-[600px] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" />
            <VisualTableMap
              storeId={storeId}
              tables={tables}
              onUpdate={fetchData}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {tables.length === 0 ? (
              <div className="col-span-full py-40 text-center bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                <Users size={48} className="text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No tables registered yet</p>
              </div>
            ) : (
              tables.map((table) => (
                <motion.div 
                  key={table.id}
                  layout
                  className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 hover:bg-white/10 transition-all group"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tight mb-2">{table.table_number}</h3>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Users size={14} />
                        <span className="font-bold text-[10px] tracking-widest uppercase">{table.capacity} SEATS</span>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase ${
                      table.status === 'occupied'
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                        : table.status === 'reserved'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : table.status === 'dirty'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}>
                      {table.status === 'occupied' ? 'OCCUPIED' : table.status === 'reserved' ? 'RESERVED' : table.status === 'dirty' ? 'DIRTY' : 'VACANT'}
                    </div>
                  </div>

                  <div className="flex gap-3 mb-6">
                    <button 
                      onClick={() => setShowQrModal(table)} 
                      className="flex-1 h-12 bg-white/5 rounded-2xl flex items-center justify-center gap-2 text-slate-400 font-bold text-[10px] tracking-widest hover:bg-white/10 hover:text-white transition-all"
                    >
                      <QrCode size={16} /> SHOW QR
                    </button>
                    <button 
                      onClick={() => handleRegenerateQr(table.id)} 
                      className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => { setEditingTable(table); setShowModal(true); }} 
                      className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-400 transition-all"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(table.id)} 
                      className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-400 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* 모달 시스템 */}
      <AnimatePresence>
        {showModal && (
          <TableModal 
            storeId={storeId} 
            table={editingTable} 
            onClose={() => setShowModal(false)} 
            onSave={() => { setShowModal(false); fetchData(); }} 
          />
        )}
        {showQrModal && (
          <QrModal 
            table={showQrModal} 
            qrUrl={getQrUrl(showQrModal.qr_code)} 
            onClose={() => setShowQrModal(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const TableModal = ({ storeId, table, onClose, onSave }) => {
  const [form, setForm] = useState({
    table_number: table?.table_number || "",
    capacity: table?.capacity || 4
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (table) await tablesAPI.update(table.id, form);
      else await tablesAPI.create({ store_id: parseInt(storeId), ...form });
      onSave();
    } catch (err) { 
      alert(err.response?.data?.error || "Save failed"); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl"
      >
        <h3 className="text-3xl font-black text-white tracking-tight mb-8">
          {table ? "EDIT TABLE" : "NEW TABLE"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Table Number</label>
            <input
              type="text"
              value={form.table_number}
              onChange={(e) => setForm({ ...form, table_number: e.target.value })}
              placeholder="e.g. Table 01"
              required
              className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/30 transition-all uppercase text-sm tracking-widest"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Capacity</label>
            <input 
              type="number" 
              value={form.capacity} 
              onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })} 
              placeholder="No. of seats" 
              min={1} 
              className="w-full px-6 py-4 bg-white/5 border border-white/5 rounded-2xl text-white font-bold outline-none focus:border-orange-500/30 transition-all uppercase text-sm tracking-widest" 
            />
          </div>
          <div className="flex gap-4 mt-8">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl font-black text-xs tracking-widest hover:text-white transition-all"
            >
              CANCEL
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-2 px-10 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs tracking-widest shadow-lg shadow-orange-500/20 hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? "SAVING..." : "SAVE TABLE"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const QrModal = ({ table, qrUrl, onClose }) => {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=0f172a`;
  
  const handleDownload = () => { 
    const link = document.createElement("a"); 
    link.href = qrImageUrl; 
    link.download = `${table.name}_QR.png`; 
    link.click(); 
  };

  const handleShare = () => {
    navigator.clipboard.writeText(qrUrl);
    alert('URL copied to clipboard!');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-slate-900 border border-white/10 rounded-[3rem] p-12 w-full max-w-md text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
          <QrCode size={32} className="text-orange-500" />
        </div>
        <h3 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">{table.name}</h3>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-8">Unique Digital Identifier</p>
        
        <div className="bg-white p-8 rounded-[2rem] mb-8 shadow-2xl">
          <img src={qrImageUrl} alt="QR Code" className="mx-auto w-full max-w-[240px]" />
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleDownload} 
            className="w-full py-4 bg-orange-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest shadow-lg shadow-orange-500/20 hover:scale-105 transition-all"
          >
            <Download size={18} /> DOWNLOAD AS PNG
          </button>
          <div className="flex gap-3">
            <button 
              onClick={handleShare} 
              className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl flex items-center justify-center gap-3 font-black text-xs tracking-widest hover:text-white transition-all"
            >
              <Share2 size={16} /> COPY URL
            </button>
            <button 
              onClick={onClose} 
              className="flex-1 py-4 bg-white/5 text-slate-500 rounded-2xl font-black text-xs tracking-widest hover:text-white transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default TableManager;
