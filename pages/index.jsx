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
const appId = 'intraksi-apps';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // PERBAIKAN: Path database disederhanakan agar mudah dibuat
        const profileRef = doc(db, 'users', currentUser.uid);
        onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
            if (data.config) setConfig(data.config);
          }
          setLoading(false);
        });

        const txRef = collection(db, 'users', currentUser.uid, 'transactions');
        onSnapshot(txRef, (snap) => {
          setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInAnonymously(auth);
      const newUser = userCredential.user;
      const formData = new FormData(e.target);

      const newProfile = {
        namaPemilik: formData.get('namaPemilik').toUpperCase(),
        namaUsaha: formData.get('namaUsaha').toUpperCase(),
        whatsapp: formData.get('whatsapp'),
        modalAwal: parseFloat(formData.get('modalAwal')) || 0,
        email: formData.get('email'),
        config: DEFAULT_CONFIG,
        createdAt: new Date().toISOString(),
        userId: newUser.uid
      };

      // PERBAIKAN: Langsung simpan ke root 'users' agar tidak error 400
      await setDoc(doc(db, 'users', newUser.uid), newProfile);
      setProfile(newProfile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden border-[8px] border-slate-800">
          <div className="bg-blue-600 p-8 text-center text-white">
            <h1 className="text-3xl font-black italic">INTRANKSI APPS</h1>
            <p className="text-[10px] font-bold uppercase mt-1">DATABASE CLOUD PRO</p>
          </div>
          <div className="p-8">
            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-[10px] font-bold rounded-xl">{error}</div>}
            <form onSubmit={handleRegister} className="space-y-4">
              <input name="namaPemilik" placeholder="NAMA PEMILIK" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold uppercase outline-none focus:border-blue-500" />
              <input name="namaUsaha" placeholder="NAMA USAHA" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold uppercase outline-none focus:border-blue-500" />
              <input name="whatsapp" placeholder="WHATSAPP (62...)" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500" />
              <input name="modalAwal" type="number" placeholder="MODAL AWAL" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500" />
              <input name="email" type="email" placeholder="EMAIL" required className="w-full bg-slate-50 border p-4 rounded-2xl text-xs font-bold outline-none focus:border-blue-500" />
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl text-xs uppercase tracking-widest italic">AKTIFKAN DATABASE</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <div className="w-72 bg-white border-r p-6 font-black text-xs space-y-4 uppercase italic">
        <div className="text-blue-600 mb-8">{profile.namaUsaha}</div>
        <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-4 rounded-xl ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : ''}`}>Dashboard</button>
        <button onClick={() => auth.signOut().then(() => window.location.reload())} className="w-full text-left p-4 text-red-500">Keluar</button>
      </div>
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-black italic uppercase">SELAMAT DATANG, {profile.namaPemilik}</h1>
        <p className="text-slate-400 font-bold text-xs mt-2 uppercase italic">Database anda sudah aktif di Cloud Firestore.</p>
      </div>
    </div>
  );
}
