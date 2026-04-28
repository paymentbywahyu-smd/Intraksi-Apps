import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Calculator, 
  Settings, 
  LogOut, 
  Wallet, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Send,
  Trash2,
  Edit3,
  Loader2,
  Save,
  X,
  ChevronRight,
  CreditCard,
  Banknote,
  Plus
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// FIREBASE IMPORTS
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot
} from 'firebase/firestore';

// INITIALIZE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCCpjTjBCU1HnjCXrA8rb-VuWC67bWmvhw",
  authDomain: "intranksi-ppob.firebaseapp.com",
  projectId: "intranksi-ppob",
  storageBucket: "intranksi-ppob.firebasestorage.app",
  messagingSenderId: "729305891845",
  appId: "1:729305891845:web:feb0d2141d275efecf486c",
  measurementId: "G-CXP5QEC7YK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_CONFIG = {
  operators: ['TELKOMSEL', 'ISAT', 'XL', 'AXIS', 'SMART', 'THREE'],
  categories: ['PULSA', 'DATA', 'PLN', 'GAME', 'E-WALLET'],
  paymentMethods: ['TUNAI', 'SALDO', 'TRANSFER']
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Menambahkan state error yang sebelumnya hilang
  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const appId = 'intranksi-ppob';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load Profile & Transactions if user exists
        const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid);
        onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Sign in anonymously to get UID
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

      await setDoc(doc(db, 'artifacts', appId, 'users', newUser.uid), newProfile);
      setProfile(newProfile);
    } catch (err) {
      console.error("AUTH ERROR:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden border-[8px] border-slate-800">
          <div className="bg-blue-600 p-8 text-center">
            <h1 className="text-3xl font-black text-white tracking-tighter italic">INTRANKSI APPS</h1>
            <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">Database Cloud Pro</p>
          </div>
          
          <div className="p-8">
            <h2 className="text-center font-black text-slate-800 mb-8 text-xs uppercase tracking-widest">Pendaftaran Usaha Baru</h2>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
                <AlertCircle size={20} />
                <p className="text-[10px] font-bold uppercase leading-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-4">
                <input name="namaPemilik" placeholder="NAMA PEMILIK" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold uppercase outline-none focus:border-blue-500 transition-all" />
                <input name="namaUsaha" placeholder="NAMA USAHA" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold uppercase outline-none focus:border-blue-500 transition-all" />
                <input name="whatsapp" placeholder="NO. WHATSAPP (62...)" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                <input name="modalAwal" type="number" placeholder="MODAL AWAL USAHA" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                <input name="email" type="email" placeholder="EMAIL KONFIRMASI" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Simpan & Aktifkan Database'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Bagian dashboard tetap sama dengan kode asli Anda...
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
       <h1 className="font-black text-slate-800">SELAMAT DATANG, {profile.namaPemilik}</h1>
       {/* Konten Dashboard Anda di sini */}
    </div>
  );
}
