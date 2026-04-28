import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Send, Trash2, Edit3, Loader2, Save, X, ChevronRight, 
  Plus, Lock, Mail, User, Building2, Phone, Hash, MessageSquare
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';

// FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  updatePassword
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, 
  addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';

// CONFIG ASLI
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
const appId = "ppob-manager-pro-v1";

const DEFAULT_CONFIG = {
  metodeBayar: ['TUNAI', 'TRANSFER', 'QRIS'],
  jenisTransaksi: ['TRANSFER BANK', 'TOP UP E-WALLET', 'TOKEN PLN', 'PULSA/DATA', 'PASCA BAYAR'],
  akunBank: ['BCA', 'MANDIRI', 'BNI', 'BRI', 'DANA', 'OVO'],
  statusBayar: ['BELUM BAYAR', 'SUDAH BAYAR']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [editingTxId, setEditingTxId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [bankBalances, setBankBalances] = useState({});

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenisTransaksi: '',
    metodeBayar: '',
    akunBank: '',
    noRekTujuan: '',
    namaPelanggan: '',
    nominal: '',
    fee: '3000',
    noWhatsapp: '',
    statusBayar: 'BELUM BAYAR',
    keterangan: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        if (data.config) setConfig(data.config);
      }
    });

    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubscribeTx = onSnapshot(txRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
      setTransactions(data);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeTx();
    };
  }, [user]);

  const sendWA = (tx) => {
    const msg = `*STRUK DIGITAL ${profile?.namaUsaha || 'PPOB'}*%0A` +
                `----------------------------------------%0A` +
                `TANGGAL: ${tx.tanggal}%0A` +
                `PELANGGAN: ${tx.namaPelanggan}%0A` +
                `LAYANAN: ${tx.jenisTransaksi}%0A` +
                `TUJUAN: ${tx.noRekTujuan}%0A` +
                `NOMINAL: Rp ${parseFloat(tx.nominal).toLocaleString()}%0A` +
                `BIAYA ADMIN: Rp ${parseFloat(tx.fee).toLocaleString()}%0A` +
                `----------------------------------------%0A` +
                `*TOTAL TAGIHAN: Rp ${parseFloat(tx.totalTagihan).toLocaleString()}*%0A` +
                `STATUS: ${tx.statusBayar}%0A` +
                `----------------------------------------%0A` +
                `TERIMA KASIH TELAH BERTRANSAKSI!`;
    
    const phone = tx.noWhatsapp.startsWith('0') ? '62' + tx.noWhatsapp.slice(1) : tx.noWhatsapp;
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleAuth = async (e, type) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      if (type === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'users', res.user.uid, 'profile', 'settings'), {
          namaUsaha: e.target.namaUsaha.value.toUpperCase(),
          pemilik: e.target.namaPemilik.value.toUpperCase(),
          modalAwal: parseFloat(e.target.modalAwal.value) || 0,
          whatsapp: e.target.whatsapp.value,
          email: email,
          config: DEFAULT_CONFIG
        });
      }
    } catch (err) { alert(err.message.toUpperCase()); }
  };

  const saveTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      ...formData,
      nominal: parseFloat(formData.nominal),
      fee: parseFloat(formData.fee),
      totalTagihan: parseFloat(formData.nominal) + parseFloat(formData.fee),
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingTxId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingTxId), payload);
        setEditingTxId(null);
      } else {
        payload.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), payload);
        // KIRIM WA OTOMATIS SETELAH SIMPAN
        sendWA({ ...payload, id: docRef.id });
      }
      setActiveTab('history');
      setFormData({ ...formData, nominal: '', namaPelanggan: '', noRekTujuan: '', noWhatsapp: '', keterangan: '' });
    } catch (err) { alert(err.message.toUpperCase()); }
  };

  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + (c.totalTagihan || 0), 0);
    const profit = transactions.reduce((a, c) => a + (c.fee || 0), 0);
    const pending = transactions.filter(t => t.statusBayar !== 'SUDAH BAYAR').reduce((a, c) => a + (c.totalTagihan || 0), 0);
    return { omset, profit, pending };
  }, [transactions]);

  const totalRealtimeAsset = (Object.values(bankBalances).reduce((a, b) => a + (parseFloat(b) || 0), 0)) + stats.pending;

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black uppercase tracking-widest"><Loader2 className="animate-spin mr-2"/> LOADING DATA...</div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
        <h2 className="text-2xl font-black text-center mb-8 uppercase tracking-tighter">PPOB MANAGER LOGIN</h2>
        <form onSubmit={(e) => handleAuth(e, 'login')} className="space-y-4">
          <input name="email" type="email" placeholder="EMAIL" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold uppercase text-xs" required />
          <input name="password" type="password" placeholder="PASSWORD" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold uppercase text-xs" required />
          <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs">MASUK DASHBOARD</button>
        </form>
        <div className="mt-8 pt-8 border-t">
            <p className="text-center text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest text-xs">DAFTAR USAHA BARU</p>
            <form onSubmit={(e) => handleAuth(e, 'register')} className="space-y-3">
                <input name="namaUsaha" placeholder="NAMA USAHA" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="modalAwal" type="number" placeholder="MODAL AWAL" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="whatsapp" placeholder="WA (62...)" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="email" type="email" placeholder="EMAIL" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="password" type="password" placeholder="PASSWORD" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <button className="w-full border-2 border-blue-600 text-blue-600 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">BUAT AKUN</button>
            </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <div className="w-full md:w-72 bg-white border-r border-slate-200 p-6 space-y-8">
        <div className="flex items-center gap-3 px-2">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100"><TrendingUp size={22} strokeWidth={3}/></div>
            <div>
                <h1 className="font-black text-xs uppercase tracking-tighter leading-none">{profile?.namaUsaha || 'LOADING...'}</h1>
                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1">SYSTEM ONLINE</p>
            </div>
        </div>

        <nav className="space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
            { id: 'input', icon: PlusCircle, label: 'INPUT TRANSAKSI' },
            { id: 'history', icon: History, label: 'RIWAYAT' },
            { id: 'calculator', icon: Calculator, label: 'CEK SALDO' },
            { id: 'settings', icon: Settings, label: 'PENGATURAN' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black text-[11px] transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <item.icon size={18} strokeWidth={3}/>
              <span className="uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <button onClick={() => signOut(auth)} className="w-full flex items-center gap-4 px-4 py-4 text-red-400 font-black text-[11px] uppercase tracking-widest mt-10"><LogOut size={18}/> LOGOUT</button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="mb-10 flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">{activeTab.replace('-', ' ')}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PPOB MANAGEMENT SYSTEM</p>
            </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'OMSET KOTOR', val: stats.omset, color: 'blue', icon: TrendingUp },
                { label: 'LABA BERSIH', val: stats.profit, color: 'green', icon: Wallet },
                { label: 'TOTAL PIUTANG', val: stats.pending, color: 'orange', icon: AlertCircle },
              ].map(card => (
                <div key={card.label} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</span>
                    <div className={`p-2 bg-${card.color}-50 text-${card.color}-600 rounded-xl`}><card.icon size={20}/></div>
                  </div>
                  <p className="text-xl font-black uppercase text-xs">RP {card.val.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
               <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-400 mb-6">GRAFIK PERFORMA</h3>
               <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={transactions.slice(0, 10).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="tanggal" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '800', fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: '800', fill: '#94a3b8'}} />
                    <Tooltip />
                    <Area type="monotone" dataKey="totalTagihan" stroke="#2563eb" fill="#dbeafe" strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm">
            <form onSubmit={saveTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase text-xs">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">TANGGAL TRANSAKSI</label>
                    <input type="date" value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">JENIS LAYANAN</label>
                    <select value={formData.jenisTransaksi} onChange={(e) => setFormData({...formData, jenisTransaksi: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" required>
                        <option value="">PILIH LAYANAN</option>
                        {config.jenisTransaksi.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">NAMA PELANGGAN</label>
                    <input placeholder="NAMA LENGKAP" value={formData.namaPelanggan} onChange={(e) => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">NO. REK / ID TUJUAN</label>
                    <input placeholder="NOMOR TUJUAN" value={formData.noRekTujuan} onChange={(e) => setFormData({...formData, noRekTujuan: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">NOMINAL TRANSAKSI</label>
                    <input type="number" placeholder="0" value={formData.nominal} onChange={(e) => setFormData({...formData, nominal: e.target.value})} className="w-full p-4 bg-blue-50 border-none rounded-2xl outline-none font-black text-blue-600 text-lg" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">BIAYA ADMIN (LABA)</label>
                    <input type="number" placeholder="0" value={formData.fee} onChange={(e) => setFormData({...formData, fee: e.target.value})} className="w-full p-4 bg-green-50 border-none rounded-2xl outline-none font-black text-green-600 text-lg" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">SUMBER SALDO</label>
                    <select value={formData.akunBank} onChange={(e) => setFormData({...formData, akunBank: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" required>
                        <option value="">PILIH BANK</option>
                        {config.akunBank.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">METODE BAYAR PELANGGAN</label>
                    <select value={formData.metodeBayar} onChange={(e) => setFormData({...formData, metodeBayar: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" required>
                        <option value="">PILIH METODE</option>
                        {config.metodeBayar.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">NO. WHATSAPP (KIRIM STRUK)</label>
                    <input placeholder="628..." value={formData.noWhatsapp} onChange={(e) => setFormData({...formData, noWhatsapp: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">STATUS PEMBAYARAN</label>
                    <select value={formData.statusBayar} onChange={(e) => setFormData({...formData, statusBayar: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-bold">
                        <option value="BELUM BAYAR">BELUM BAYAR (HUTANG)</option>
                        <option value="SUDAH BAYAR">SUDAH BAYAR (LUNAS)</option>
                    </select>
                </div>
                <button className="md:col-span-2 w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-blue-100 mt-4 flex items-center justify-center gap-3">
                   <Save size={20}/> SIMPAN & KIRIM NOTIFIKASI WA
                </button>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden text-xs uppercase">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                    <th className="p-6">TANGGAL</th>
                    <th className="p-6">PELANGGAN / TUJUAN</th>
                    <th className="p-6">LAYANAN</th>
                    <th className="p-6">TOTAL TAGIHAN</th>
                    <th className="p-6">STATUS</th>
                    <th className="p-6">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-all">
                      <td className="p-6">{tx.tanggal}</td>
                      <td className="p-6">
                        <p className="text-slate-900">{tx.namaPelanggan}</p>
                        <p className="text-[10px] text-slate-400">{tx.noRekTujuan}</p>
                      </td>
                      <td className="p-6"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] font-black">{tx.jenisTransaksi}</span></td>
                      <td className="p-6 font-black text-slate-900">RP {(tx.totalTagihan || 0).toLocaleString()}</td>
                      <td className="p-6">
                        <button 
                          onClick={async () => await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id), { statusBayar: tx.statusBayar === 'SUDAH BAYAR' ? 'BELUM BAYAR' : 'SUDAH BAYAR' })}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black ${tx.statusBayar === 'SUDAH BAYAR' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}
                        >
                          {tx.statusBayar}
                        </button>
                      </td>
                      <td className="p-6">
                        <div className="flex gap-2">
                           <button onClick={() => sendWA(tx)} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><MessageSquare size={16}/></button>
                           <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id))} className="p-2 text-red-300 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs uppercase">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-black tracking-tighter text-slate-800">REKAP SALDO FISIK</h3>
              {config.akunBank.map(bank => (
                <div key={bank} className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1">SALDO {bank}</label>
                   <input type="number" placeholder="0" value={bankBalances[bank] || ''} onChange={(e) => setBankBalances({...bankBalances, [bank]: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black" />
                </div>
              ))}
            </div>
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-8">
               <div>
                  <p className="text-white/40 text-[10px] font-black tracking-widest">ESTIMASI TOTAL ASET (SALDO + PIUTANG)</p>
                  <h4 className="text-3xl font-black tracking-tighter">RP {totalRealtimeAsset.toLocaleString()}</h4>
               </div>
               <div className={`p-6 rounded-3xl flex items-center justify-between ${totalRealtimeAsset >= (profile?.modalAwal || 0) ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  <div>
                    <p className="text-[9px] font-black uppercase">KONDISI MODAL</p>
                    <p className="text-lg font-black">{totalRealtimeAsset >= (profile?.modalAwal || 0) ? 'SURPLUS / UNTUNG' : 'DEFISIT / RUGI'}</p>
                  </div>
                  <CheckCircle2 size={32}/>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8 text-xs uppercase">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="font-black tracking-tighter text-slate-800 flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div> PROFIL & KONTROL USAHA
                    </h3>
                </div>
                
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    setSaveStatus('loading');
                    try {
                        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), {
                            namaUsaha: e.target.namaUsaha.value.toUpperCase(),
                            whatsapp: e.target.whatsapp.value,
                            modalAwal: parseFloat(e.target.modalAwal.value) || 0
                        });
                        setSaveStatus('success');
                        setTimeout(() => setSaveStatus(''), 3000);
                    } catch (err) { setSaveStatus('error'); }
                }} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1 flex items-center gap-2"><Building2 size={14}/> NAMA USAHA</label>
                            <input name="namaUsaha" defaultValue={profile?.namaUsaha} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1 flex items-center gap-2"><Phone size={14}/> NO WHATSAPP USAHA</label>
                            <input name="whatsapp" defaultValue={profile?.whatsapp} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" required />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1 flex items-center gap-2"><Wallet size={14}/> TARGET MODAL AWAL</label>
                            <input name="modalAwal" type="number" defaultValue={profile?.modalAwal} className="w-full p-4 bg-blue-50 rounded-2xl outline-none font-black text-blue-600" required />
                        </div>
                    </div>
                    <button className="md:col-span-2 w-full bg-blue-600 text-white py-5 rounded-2xl font-black tracking-widest shadow-xl shadow-blue-100 flex items-center justify-center gap-3">
                        {saveStatus === 'loading' ? <Loader2 className="animate-spin"/> : <Save size={18}/>} SIMPAN PERUBAHAN
                    </button>
                </form>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </div>
  );
}
