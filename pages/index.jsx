import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, PlusCircle, History, Calculator, Settings, 
  LogOut, Wallet, TrendingUp, AlertCircle, CheckCircle2, 
  Trash2, Loader2, Save, X, Plus, Building2, Phone, MessageSquare,
  ChevronRight, ArrowRightLeft, CreditCard, Banknote, Edit3, Send
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
  signOut
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, onSnapshot, collection, 
  addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';

// CONFIG FIREBASE
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
  const [saveStatus, setSaveStatus] = useState('');
  const [bankBalances, setBankBalances] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [selectedCustomers, setSelectedCustomers] = useState(new Set());
  const [showBillingPreview, setShowBillingPreview] = useState(null);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    jenisTransaksi: '',
    metodeBayar: 'TUNAI',
    akunBank: '',
    noRekTujuan: '',
    namaPelanggan: '',
    nominal: '',
    fee: '3000',
    noWhatsapp: '',
    statusBayar: 'BELUM BAYAR',
    keterangan: ''
  });

  // AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // REALTIME DATA LISTENER
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings');
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        if (data.config) setConfig(data.config);
        if (data.bankBalances) setBankBalances(data.bankBalances);
      }
    });

    const txRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubscribeTx = onSnapshot(txRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
      setTransactions(data);
    }, (err) => console.error("FIRESTORE ERROR:", err));

    return () => {
      unsubscribeProfile();
      unsubscribeTx();
    };
  }, [user]);

  // KIRIM WHATSAPP
  const sendWA = (tx) => {
    // Pastikan transaksi saat ini masuk dalam evaluasi, 
    // berguna jika WA dikirim langsung setelah data baru disimpan (sebelum sinkronisasi Firestore selesai)
    const isTxInState = transactions.some(t => t.id === tx.id);
    const allTx = isTxInState ? transactions : [...transactions, tx];

    // Status yang dianggap sebagai piutang (berdasarkan data master Anda)
    const unpaidStatuses = ['BELUM BAYAR'];

    // Filter transaksi pelanggan yang SAMA dan statusnya BELUM BAYAR
    const unpaidTxList = allTx.filter(
      (item) =>
        item.namaPelanggan?.toLowerCase() === tx.namaPelanggan?.toLowerCase() &&
        unpaidStatuses.includes(item.statusBayar)
    );

    let msg = '';

    // Logika: Jika ada tunggakan, gabungkan. Jika tidak ada tunggakan, kirim struk tunggal.
    if (unpaidTxList.length > 0) {
      let totalSemuaTagihan = 0;
      let rincianMsg = '';

      unpaidTxList.forEach((item, index) => {
        const tagihanItem = parseFloat(item.totalTagihan) || 0;
        totalSemuaTagihan += tagihanItem;
        rincianMsg += `${index + 1}. ${item.tanggal} | ${item.jenisTransaksi} (${item.noRekTujuan}) : Rp ${tagihanItem.toLocaleString('id-ID')}\n`;
      });

      msg = 
        `*INFO TAGIHAN ${profile?.namaUsaha || 'PPOB'}*\n` +
        `----------------------------------------\n` +
        `Halo *${tx.namaPelanggan}*, berikut rincian tagihan transaksi Anda yang belum lunas:\n\n` +
        `${rincianMsg}\n` +
        `----------------------------------------\n` +
        `*TOTAL KESELURUHAN: Rp ${totalSemuaTagihan.toLocaleString('id-ID')}*\n` +
        `----------------------------------------\n` +
        `Mohon agar dapat segera diselesaikan. Terima kasih atas kepercayaannya!`;

    } else {
      // Fallback: Kirim struk transaksi tunggal biasa (jika statusnya LUNAS dan tidak punya hutang lain)
      msg = 
        `*STRUK DIGITAL ${profile?.namaUsaha || 'PPOB'}*\n` +
        `----------------------------------------\n` +
        `TANGGAL: ${tx.tanggal}\n` +
        `PELANGGAN: ${tx.namaPelanggan}\n` +
        `LAYANAN: ${tx.jenisTransaksi}\n` +
        `TUJUAN: ${tx.noRekTujuan}\n` +
        `NOMINAL: Rp ${(parseFloat(tx.nominal) || 0).toLocaleString('id-ID')}\n` +
        `BIAYA ADMIN: Rp ${(parseFloat(tx.fee) || 0).toLocaleString('id-ID')}\n` +
        `----------------------------------------\n` +
        `*TOTAL TAGIHAN: Rp ${(parseFloat(tx.totalTagihan) || 0).toLocaleString('id-ID')}*\n` +
        `STATUS: ${tx.statusBayar}\n` +
        `----------------------------------------\n` +
        `TERIMA KASIH TELAH BERTRANSAKSI!`;
    }
    
    let phone = tx.noWhatsapp || '';
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    if (!phone.startsWith('62')) phone = '62' + phone;
    
    // Gunakan encodeURIComponent agar karakter \n dan spasi aman di URL
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // GET CUSTOMERS WITH UNPAID BALANCE
  const getCustomersWithBalance = useMemo(() => {
    const unpaidStatuses = ['BELUM BAYAR'];
    const customerMap = {};

    transactions.forEach(tx => {
      if (unpaidStatuses.includes(tx.statusBayar)) {
        const key = tx.namaPelanggan?.toLowerCase() || '';
        if (!customerMap[key]) {
          customerMap[key] = {
            namaPelanggan: tx.namaPelanggan,
            noWhatsapp: tx.noWhatsapp,
            totalTagihan: 0,
            transactionCount: 0,
            transactions: []
          };
        }
        customerMap[key].totalTagihan += parseFloat(tx.totalTagihan) || 0;
        customerMap[key].transactionCount += 1;
        customerMap[key].transactions.push(tx);
      }
    });

    return Object.values(customerMap).sort((a, b) => b.totalTagihan - a.totalTagihan);
  }, [transactions]);

  // TOGGLE CUSTOMER SELECTION
  const toggleCustomerSelection = (customerName) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerName)) {
      newSelected.delete(customerName);
    } else {
      newSelected.add(customerName);
    }
    setSelectedCustomers(newSelected);
  };

  // SEND BULK BILLING
  const sendBulkBilling = async () => {
    if (selectedCustomers.size === 0) {
      alert('PILIH MINIMAL 1 PELANGGAN');
      return;
    }

    const customersToSend = getCustomersWithBalance.filter(c => 
      selectedCustomers.has(c.namaPelanggan)
    );

    for (const customer of customersToSend) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay to prevent WhatsApp blocking
      sendWA(customer.transactions[0]);
    }

    setSelectedCustomers(new Set());
    alert(`TAGIHAN TELAH DIKIRIM KE ${customersToSend.length} PELANGGAN`);
  };

  // AUTH HANDLER
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
          modalAwal: parseFloat(e.target.modalAwal.value) || 0,
          whatsapp: e.target.whatsapp.value,
          email: email,
          config: DEFAULT_CONFIG,
          bankBalances: {}
        });
      }
    } catch (err) { alert(err.message.toUpperCase()); }
  };

  // SIMPAN/EDIT TRANSAKSI
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
      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', editingId), payload);
        setEditingId(null);
      } else {
        payload.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), payload);
        sendWA({ ...payload, id: docRef.id });
      }
      setActiveTab('history');
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        jenisTransaksi: '',
        metodeBayar: 'TUNAI',
        akunBank: '',
        noRekTujuan: '',
        namaPelanggan: '',
        nominal: '',
        fee: '3000',
        noWhatsapp: '',
        statusBayar: 'BELUM BAYAR',
        keterangan: ''
      });
    } catch (err) { alert("GAGAL MENYIMPAN: " + err.message.toUpperCase()); }
  };

  const handleEdit = (tx) => {
    setEditingId(tx.id);
    setFormData({ ...tx });
    setActiveTab('input');
  };

  // UPDATE CONFIG
  const updateConfig = async (key, newList) => {
    if (!user) return;
    const newConfig = { ...config, [key]: newList };
    setConfig(newConfig);
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), { config: newConfig });
  };

  // STATISTIK
  const stats = useMemo(() => {
    const omset = transactions.reduce((a, c) => a + (c.totalTagihan || 0), 0);
    const profit = transactions.reduce((a, c) => a + (c.fee || 0), 0);
    const pending = transactions.filter(t => t.statusBayar !== 'SUDAH BAYAR').reduce((a, c) => a + (c.totalTagihan || 0), 0);
    return { omset, profit, pending };
  }, [transactions]);

  const totalRealtimeAsset = (Object.values(bankBalances).reduce((a, b) => a + (parseFloat(b) || 0), 0)) + stats.pending;

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black uppercase tracking-widest"><Loader2 className="animate-spin mr-2"/> MEMUAT DATA...</div>;

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8">
        <h2 className="text-2xl font-black text-center mb-8 uppercase tracking-tighter text-slate-800">PPOB MANAGER LOGIN</h2>
        <form onSubmit={(e) => handleAuth(e, 'login')} className="space-y-4">
          <input name="email" type="email" placeholder="EMAIL" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold uppercase text-xs" required />
          <input name="password" type="password" placeholder="PASSWORD" className="w-full p-4 bg-slate-50 border rounded-2xl outline-none font-bold uppercase text-xs" required />
          <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-200">MASUK DASHBOARD</button>
        </form>
        <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-center text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">ATAU DAFTAR USAHA BARU</p>
            <form onSubmit={(e) => handleAuth(e, 'register')} className="space-y-3">
                <input name="namaUsaha" placeholder="NAMA USAHA" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="modalAwal" type="number" placeholder="MODAL AWAL" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="whatsapp" placeholder="WA (CONTOH: 628...)" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="email" type="email" placeholder="EMAIL" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <input name="password" type="password" placeholder="PASSWORD" className="w-full p-3 bg-slate-50 border rounded-xl outline-none font-bold uppercase text-[10px]" required />
                <button className="w-full border-2 border-blue-600 text-blue-600 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-50 transition-all">BUAT AKUN</button>
            </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <div className="w-full md:w-72 bg-white border-r border-slate-200 p-6 space-y-8 flex flex-col">
        <div className="flex items-center gap-3 px-2">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100"><TrendingUp size={22} strokeWidth={3}/></div>
            <div>
                <h1 className="font-black text-xs uppercase tracking-tighter leading-none">{profile?.namaUsaha || 'LOADING...'}</h1>
                <p className="text-[9px] font-black text-green-500 uppercase tracking-widest mt-1">SYSTEM AKTIF</p>
            </div>
        </div>

        <nav className="space-y-1 flex-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
            { id: 'input', icon: PlusCircle, label: 'TRANSAKSI BARU' },
            { id: 'history', icon: History, label: 'RIWAYAT' },
            { id: 'billing', icon: Send, label: 'BILLING MASSAL' },
            { id: 'calculator', icon: Calculator, label: 'CEK SALDO' },
            { id: 'settings', icon: Settings, label: 'PENGATURAN' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setEditingId(null); }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl font-black text-[11px] transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <item.icon size={18} strokeWidth={3}/>
              <span className="uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>

        <button onClick={() => signOut(auth)} className="w-full flex items-center gap-4 px-4 py-4 text-red-400 font-black text-[11px] uppercase tracking-widest border-t border-slate-50 pt-6"><LogOut size={18}/> KELUAR</button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar">
        <header className="mb-10">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">{editingId ? 'EDIT TRANSAKSI' : activeTab.replace('-', ' ')}</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MANAJEMEN KEUANGAN PPOB V1.0</p>
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
                  <p className="text-xl font-black text-slate-800">RP {card.val.toLocaleString()}</p>
                </div>
              ))}
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
               <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-400 mb-6">GRAFIK TRANSAKSI TERAKHIR</h3>
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
            <form onSubmit={saveTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-6 uppercase text-xs font-black">
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">TANGGAL</label>
                    <input type="date" value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">JENIS LAYANAN</label>
                    <select value={formData.jenisTransaksi} onChange={(e) => setFormData({...formData, jenisTransaksi: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black" required>
                        <option value="">PILIH LAYANAN</option>
                        {config.jenisTransaksi.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">NAMA PELANGGAN</label>
                    <input placeholder="NAMA LENGKAP" value={formData.namaPelanggan} onChange={(e) => setFormData({...formData, namaPelanggan: e.target.value.toUpperCase()})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">ID / NO. REK TUJUAN</label>
                    <input placeholder="NOMOR TUJUAN" value={formData.noRekTujuan} onChange={(e) => setFormData({...formData, noRekTujuan: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">NOMINAL (RP)</label>
                    <input type="number" placeholder="0" value={formData.nominal} onChange={(e) => setFormData({...formData, nominal: e.target.value})} className="w-full p-4 bg-blue-50 border-none rounded-2xl outline-none font-black text-blue-600 text-lg" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">ADMIN / LABA (RP)</label>
                    <input type="number" placeholder="0" value={formData.fee} onChange={(e) => setFormData({...formData, fee: e.target.value})} className="w-full p-4 bg-green-50 border-none rounded-2xl outline-none font-black text-green-600 text-lg" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">METODE BAYAR</label>
                    <select value={formData.metodeBayar} onChange={(e) => setFormData({...formData, metodeBayar: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black">
                        {config.metodeBayar.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">PILIH BANK/E-WALLET</label>
                    <select value={formData.akunBank} onChange={(e) => setFormData({...formData, akunBank: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black">
                        <option value="">PILIH AKUN</option>
                        {config.akunBank.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">WHATSAPP PELANGGAN</label>
                    <input placeholder="628..." value={formData.noWhatsapp} onChange={(e) => setFormData({...formData, noWhatsapp: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black" required />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">STATUS BAYAR</label>
                    <select value={formData.statusBayar} onChange={(e) => setFormData({...formData, statusBayar: e.target.value})} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none font-black">
                        <option value="BELUM BAYAR">HUTANG (BELUM BAYAR)</option>
                        <option value="SUDAH BAYAR">LUNAS (SUDAH BAYAR)</option>
                    </select>
                </div>
                <button className="md:col-span-2 w-full bg-blue-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-blue-100 mt-4 flex items-center justify-center gap-3 hover:scale-[1.01] transition-all">
                   {editingId ? <Save size={20}/> : <MessageSquare size={20}/>} 
                   {editingId ? 'PERBARUI DATA' : 'SIMPAN & KIRIM STRUK WA'}
                </button>
            </form>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden text-[10px] uppercase">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="font-black text-slate-400 tracking-widest uppercase border-b border-slate-100">
                    <th className="p-6">TANGGAL</th>
                    <th className="p-6">PELANGGAN / TUJUAN</th>
                    <th className="p-6">LAYANAN</th>
                    <th className="p-6">SUMBER / METODE</th>
                    <th className="p-6">TOTAL</th>
                    <th className="p-6">STATUS</th>
                    <th className="p-6 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-bold">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-all text-slate-600">
                      <td className="p-6">{tx.tanggal}</td>
                      <td className="p-6">
                        <div className="font-black text-slate-900">{tx.namaPelanggan}</div>
                        <div className="text-[9px] text-slate-400 tracking-tight">{tx.noRekTujuan}</div>
                      </td>
                      <td className="p-6"><span className="bg-slate-100 px-2 py-1 rounded text-[9px]">{tx.jenisTransaksi}</span></td>
                      <td className="p-6">
                        <div className="text-slate-900">{tx.metodeBayar}</div>
                        <div className="text-[8px] text-blue-500">{tx.akunBank || '-'}</div>
                      </td>
                      <td className="p-6 font-black text-slate-900 text-xs">RP {(tx.totalTagihan || 0).toLocaleString()}</td>
                      <td className="p-6">
                        <button 
                          onClick={async () => await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id), { statusBayar: tx.statusBayar === 'SUDAH BAYAR' ? 'BELUM BAYAR' : 'SUDAH BAYAR' })}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${tx.statusBayar === 'SUDAH BAYAR' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}
                        >
                          {tx.statusBayar}
                        </button>
                      </td>
                      <td className="p-6">
                        <div className="flex justify-center gap-2">
                           <button onClick={() => sendWA(tx)} className="p-2 bg-green-50 text-green-600 rounded-lg"><MessageSquare size={14}/></button>
                           <button onClick={() => handleEdit(tx)} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Edit3 size={14}/></button>
                           <button onClick={async () => { if(confirm("HAPUS DATA INI?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', tx.id)) }} className="p-2 text-red-300 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="font-black text-[12px] uppercase tracking-widest text-slate-800">DAFTAR PELANGGAN DENGAN TAGIHAN</h3>
                  <p className="text-[9px] text-slate-400 font-black uppercase mt-2">{getCustomersWithBalance.length} PELANGGAN DENGAN PIUTANG</p>
                </div>
                <button 
                  onClick={sendBulkBilling}
                  disabled={selectedCustomers.size === 0}
                  className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${selectedCustomers.size === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-green-600 text-white shadow-lg shadow-green-200 hover:scale-105 active:scale-95'}`}
                >
                  <Send size={16}/> KIRIM {selectedCustomers.size} TAGIHAN
                </button>
              </div>

              <div className="space-y-3">
                {getCustomersWithBalance.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle size={32} className="mx-auto text-slate-300 mb-2"/>
                    <p className="text-[11px] font-black text-slate-400 uppercase">TIDAK ADA PELANGGAN DENGAN TAGIHAN</p>
                  </div>
                ) : (
                  getCustomersWithBalance.map((customer) => (
                    <div 
                      key={customer.namaPelanggan}
                      onClick={() => toggleCustomerSelection(customer.namaPelanggan)}
                      className={`p-4 rounded-2xl cursor-pointer transition-all border-2 flex items-center justify-between ${selectedCustomers.has(customer.namaPelanggan) ? 'bg-blue-50 border-blue-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedCustomers.has(customer.namaPelanggan) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                          {selectedCustomers.has(customer.namaPelanggan) && <CheckCircle2 size={16} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-black text-[11px] text-slate-900 uppercase">{customer.namaPelanggan}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{customer.transactionCount} TRANSAKSI | {customer.noWhatsapp}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[11px] text-slate-900 uppercase">RP {customer.totalTagihan.toLocaleString()}</p>
                        <p className="text-[8px] text-slate-400 font-bold">TOTAL TAGIHAN</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs uppercase">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-black tracking-tighter text-slate-800 uppercase flex items-center gap-2"><Wallet size={18}/> INPUT SALDO BANK (REALTIME)</h3>
              <p className="text-[9px] text-slate-400 font-black -mt-4">MASUKKAN SALDO YANG ADA DI APLIKASI/ATM ANDA SAAT INI</p>
              {config.akunBank.map(bank => (
                <div key={bank} className="space-y-2">
                   <label className="text-[9px] font-black text-slate-400 tracking-widest ml-1 uppercase">SALDO {bank}</label>
                   <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-300">RP</span>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={bankBalances[bank] || ''} 
                        onChange={async (e) => {
                            const newVal = e.target.value;
                            const newBalances = {...bankBalances, [bank]: newVal};
                            setBankBalances(newBalances);
                            await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'settings'), { bankBalances: newBalances });
                        }} 
                        className="w-full p-4 pl-10 bg-slate-50 rounded-2xl outline-none font-black" 
                      />
                   </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col justify-between shadow-2xl shadow-slate-200">
               <div className="space-y-2">
                  <p className="text-white/40 text-[10px] font-black tracking-widest uppercase">ESTIMASI TOTAL KEKAYAAN USAHA</p>
                  <h4 className="text-4xl font-black tracking-tighter">RP {totalRealtimeAsset.toLocaleString()}</h4>
                  <p className="text-[9px] text-white/30 font-bold italic lowercase">(total saldo fisik + piutang pelanggan belum lunas)</p>
               </div>

               <div className="space-y-4 mt-10">
                   <div className="flex justify-between items-center text-[10px] font-black text-white/50 border-b border-white/10 pb-2 uppercase">
                       <span>MODAL AWAL ANDA</span>
                       <span>RP {(profile?.modalAwal || 0).toLocaleString()}</span>
                   </div>
                   <div className={`p-6 rounded-3xl flex items-center justify-between ${totalRealtimeAsset >= (profile?.modalAwal || 0) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest mb-1">STATUS KEUANGAN</p>
                        <p className="text-xl font-black uppercase">{totalRealtimeAsset >= (profile?.modalAwal || 0) ? 'SURPLUS (UNTUNG)' : 'DEFISIT (RUGI)'}</p>
                        <p className="text-[10px] mt-1 font-bold">SELISIH: RP {Math.abs(totalRealtimeAsset - (profile?.modalAwal || 0)).toLocaleString()}</p>
                      </div>
                      <CheckCircle2 size={32} strokeWidth={3}/>
                   </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8 text-xs uppercase font-black">
            {/* PROFIL SECTION */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="tracking-tighter text-slate-800 mb-8 flex items-center gap-2 underline decoration-blue-500 decoration-4 underline-offset-8 uppercase">PENGATURAN PROFIL USAHA</h3>
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
                            <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">NAMA USAHA PPOB</label>
                            <input name="namaUsaha" defaultValue={profile?.namaUsaha} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">WHATSAPP ADMIN (628...)</label>
                            <input name="whatsapp" defaultValue={profile?.whatsapp} className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black" required />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-400 tracking-widest ml-1 uppercase">TARGET MODAL AWAL (RP)</label>
                            <input name="modalAwal" type="number" defaultValue={profile?.modalAwal} className="w-full p-4 bg-blue-50 rounded-2xl outline-none font-black text-blue-600" required />
                        </div>
                    </div>
                    <button className="md:col-span-2 w-full bg-slate-900 text-white py-5 rounded-2xl font-black tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
                        {saveStatus === 'loading' ? <Loader2 className="animate-spin"/> : <Save size={18}/>} SIMPAN PERUBAHAN PROFIL
                    </button>
                </form>
            </div>

            {/* CONFIG SECTION */}
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="tracking-tighter text-slate-800 mb-8 underline decoration-green-500 decoration-4 underline-offset-8 uppercase">KONFIGURASI DATA MASTER</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   {['jenisTransaksi', 'akunBank', 'metodeBayar'].map(key => (
                     <div key={key} className="space-y-4">
                        <label className="text-[10px] text-slate-400 tracking-widest mb-2 flex items-center gap-2 uppercase font-black">
                            {key === 'jenisTransaksi' ? <ArrowRightLeft size={14}/> : key === 'akunBank' ? <CreditCard size={14}/> : <Banknote size={14}/>} 
                            {key === 'jenisTransaksi' ? 'DAFTAR LAYANAN' : key === 'akunBank' ? 'DAFTAR BANK/E-WALLET' : 'METODE BAYAR'}
                        </label>
                        <div className="bg-slate-50 p-4 rounded-3xl min-h-[150px] space-y-2">
                            {config[key].map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm group">
                                    <span className="font-black text-[10px] tracking-widest uppercase">{item}</span>
                                    <button onClick={() => updateConfig(key, config[key].filter((_, i) => i !== idx))} className="text-red-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><X size={14}/></button>
                                </div>
                            ))}
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const val = e.target.newItem.value.toUpperCase();
                                if(val) { updateConfig(key, [...config[key], val]); e.target.reset(); }
                            }} className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                                <input name="newItem" className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none font-black" placeholder="TAMBAH..." />
                                <button className="bg-blue-600 text-white p-3 rounded-xl hover:scale-110 active:scale-90 transition-all"><Plus size={18}/></button>
                            </form>
                        </div>
                     </div>
                   ))}
                </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}
