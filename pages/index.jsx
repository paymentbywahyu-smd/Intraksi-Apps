import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Send, Trash2, Edit3, Loader2, Save, X, ChevronRight, 
  CreditCard, Banknote, Plus 
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';

// FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAC2R3MExfYGVyeX_r81gw6eeowC4Cvn9M",
  authDomain: "intraksi-apps.firebaseapp.com",
  projectId: "intraksi-apps",
  storageBucket: "intraksi-apps.firebasestorage.app",
  messagingSenderId: "741631853497",
  appId: "1:741631853497:web:288406289b0bcede096c68"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_CONFIG = {
  metodeBayar: ['TUNAI', 'TRANSFER', 'QRIS'],
  jenisTransaksi: ['TRANSFER BANK', 'TOP UP E-WALLET', 'TOKEN PLN', 'PULSA/DATA'],
  akunBank: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'DANA', 'OVO'],
  statusBayar: ['BELUM BAYAR', 'SUDAH BAYAR']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editingTxId, setEditingTxId] = useState(null);
  const [bankBalances, setBankBalances] = useState({});

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '',
    namaPelanggan: '', nominal: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const profileRef = doc(db, 'users', currentUser.uid);
        onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
            if (data.config) setConfig(data.config);
            if (data.bankBalances) setBankBalances(data.bankBalances);
          }
          setLoading(false);
        });

        const txRef = collection(db, 'users', currentUser.uid, 'transactions');
        onSnapshot(txRef, (snap) => {
          const txData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          txData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
          setTransactions(txData);
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const calculateFee = (nominal) => {
    const n = parseFloat(nominal);
    if (isNaN(n)) return 0;
    if (n < 100000) return 3000;
    if (n < 300000) return 5000;
    if (n < 1000000) return 7000;
    return n * 0.01;
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    const fee = calculateFee(formData.nominal);
    const payload = { 
      ...formData, 
      nominal: parseFloat(formData.nominal), 
      fee, 
      totalTagihan: parseFloat(formData.nominal) + fee, 
      updatedAt: new Date().toISOString() 
    };
    try {
      if (editingTxId) { 
        await updateDoc(doc(db, 'users', user.uid, 'transactions', editingTxId), payload); 
        setEditingTxId(null); 
      } else { 
        payload.timestamp = new Date().toISOString(); 
        await addDoc(collection(db, 'users', user.uid, 'transactions'), payload); 
      }
      setActiveTab('history');
      setFormData({ 
        tanggal: new Date().toISOString().split('T')[0], 
        jenisTransaksi: '', metodeBayar: '', akunBank: '', noRekTujuan: '', 
        namaPelanggan: '', nominal: '', noWhatsapp: '', statusBayar: 'BELUM BAYAR' 
      });
    } catch (e) { setError(e.message); }
  };

  const updateConfig = async (key, newList) => {
    const newConfig = { ...config, [key]: newList };
    setConfig(newConfig);
    await updateDoc(doc(db, 'users', user.uid), { config: newConfig });
  };

  const sendAgregatedWA = (targetTx) => {
    const pendingItems = transactions.filter(t => t.noWhatsapp === targetTx.noWhatsapp && t.statusBayar === 'BELUM BAYAR');
    let total = 0;
    let detail = "";
    pendingItems.forEach((item, index) => {
      total += item.totalTagihan;
      detail += `${index + 1}. *${item.jenisTransaksi}* - RP ${item.totalTagihan.toLocaleString()}%0A`;
    });
    const pesan = `*TAGIHAN ${profile.namaUsaha}*%0A%0AHALO *${targetTx.namaPelanggan}*, BERIKUT RINCIANNYA:%0A%0A${detail}%0A*TOTAL: RP ${total.toLocaleString()}*`;
    window.open(`https://wa.me/${targetTx.noWhatsapp}?text=${pesan}`, '_blank');
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + (c.totalTagihan || 0), 0);
    const profit = transactions.reduce((a, c) => a + (c.fee || 0), 0);
    const pending = transactions.filter(t => t.statusBayar === 'BELUM BAYAR').reduce((a, c) => a + (c.totalTagihan || 0), 0);
    return { omset, profit, pending };
  }, [transactions]);

  if (loading && !profile) return <div className="min-h-screen bg-slate-900 flex items-center justify-center font-black italic text-blue-500"><Loader2 className="animate-spin" /></div>;

  if (!profile) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* FORM PENDAFTARAN ANDA DISINI (DIHAPUS UNTUK SINGKAT, TAPI LOGIKANYA TETAP SAMA) */}
      <div className="bg-white p-8 rounded-[40px] border-[8px] border-slate-800 w-full max-w-md font-black italic text-center">
        <h1 className="text-2xl text-blue-600 mb-4">DAFTARKAN DATABASE ANDA</h1>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white p-4 rounded-2xl w-full">MUAT ULANG HALAMAN</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-black italic text-[10px] uppercase">
      {/* SIDEBAR */}
      <div className="w-full md:w-64 bg-white border-r flex flex-col shrink-0">
        <div className="p-6 border-b text-blue-600 text-sm tracking-tighter">{profile.namaUsaha}</div>
        <nav className="flex-1 p-4 space-y-1">
          {['dashboard', 'input', 'history', 'calculator', 'settings'].map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`w-full text-left px-5 py-4 rounded-2xl ${activeTab === id ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{id}</button>
          ))}
          <button onClick={() => auth.signOut().then(() => window.location.reload())} className="w-full text-left px-5 py-4 text-red-500 mt-10">KELUAR</button>
        </nav>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="bg-white p-6 rounded-[30px] border">OMSET: RP {stats.omset.toLocaleString()}</div>
              <div className="bg-white p-6 rounded-[30px] border text-green-600">PROFIT: RP {stats.profit.toLocaleString()}</div>
              <div className="bg-white p-6 rounded-[30px] border text-orange-600">PIUTANG: RP {stats.pending.toLocaleString()}</div>
            </div>
            <div className="h-64 bg-white p-6 rounded-[30px] border">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transactions.slice().reverse()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tanggal" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="totalTagihan" stroke="#2563eb" fill="#2563eb33" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-[30px] border space-y-4">
            <input type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" />
            <select value={formData.jenisTransaksi} onChange={e => setFormData({...formData, jenisTransaksi: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none">
              <option value="">PILIH LAYANAN</option>
              {config.jenisTransaksi.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="NAMA PELANGGAN" value={formData.namaPelanggan} onChange={e => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" />
            <input type="number" placeholder="NOMINAL" value={formData.nominal} onChange={e => setFormData({...formData, nominal: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" />
            <input placeholder="NOMOR WHATSAPP" value={formData.noWhatsapp} onChange={e => setFormData({...formData, noWhatsapp: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" />
            <button onClick={saveTransaction} className="w-full bg-blue-600 text-white py-5 rounded-2xl tracking-widest">SIMPAN KE CLOUD</button>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-[30px] border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr><th className="p-4">PELANGGAN</th><th className="p-4">LAYANAN</th><th className="p-4">TOTAL</th><th className="p-4">STATUS</th><th className="p-4 text-center">AKSI</th></tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className="border-b hover:bg-slate-50">
                    <td className="p-4">{tx.namaPelanggan}</td><td className="p-4">{tx.jenisTransaksi}</td><td className="p-4">RP {tx.totalTagihan.toLocaleString()}</td>
                    <td className="p-4"><span className={`px-3 py-1 rounded-full ${tx.statusBayar === 'SUDAH BAYAR' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{tx.statusBayar}</span></td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => sendAgregatedWA(tx)} className="p-2 bg-green-500 text-white rounded-lg"><Send size={14}/></button>
                      <button onClick={() => { setFormData(tx); setEditingTxId(tx.id); setActiveTab('input'); }} className="p-2 bg-blue-500 text-white rounded-lg"><Edit3 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="max-w-xl mx-auto bg-white p-8 rounded-[30px] border">
            <h2 className="mb-6 text-blue-600">KALKULATOR SALDO & ASET</h2>
            {config.akunBank.map(bank => (
              <div key={bank} className="flex items-center gap-4 mb-4">
                <span className="w-24">{bank}</span>
                <input type="number" value={bankBalances[bank] || ''} onChange={async (e) => {
                  const newBalances = {...bankBalances, [bank]: e.target.value};
                  setBankBalances(newBalances);
                  await updateDoc(doc(db, 'users', user.uid), { bankBalances: newBalances });
                }} className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none" placeholder="MASUKKAN SALDO" />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.keys(DEFAULT_CONFIG).map(key => (
              <div key={key} className="bg-white p-6 rounded-[30px] border">
                <h3 className="mb-4 text-blue-600">{key.toUpperCase()}</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {config[key].map((item, idx) => (
                    <div key={idx} className="bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-2">
                      {item} <button onClick={() => updateConfig(key, config[key].filter((_, i) => i !== idx))} className="text-red-500"><X size={12}/></button>
                    </div>
                  ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); const val = e.target.newItem.value.toUpperCase(); if(val) { updateConfig(key, [...config[key], val]); e.target.reset(); }}} className="flex gap-2">
                  <input name="newItem" className="flex-1 p-3 bg-slate-50 border rounded-xl" placeholder="TAMBAH..." />
                  <button className="bg-blue-600 text-white p-3 rounded-xl"><Plus size={16}/></button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
