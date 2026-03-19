import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from "react";
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, onValue, push, set, get } from "firebase/database";
import {
  getStorage,
  ref as sRef,
  listAll,
  getDownloadURL,
} from "firebase/storage";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

type Dish = {
  id: string;
  available?: boolean;
  category?: string;
  discount?: number;
  imageUrl?: string;
  name?: string;
  emoji?: string;
  popular?: boolean;
  spicy?: boolean;
  veg?: boolean;
  weight?: string;
  nameGe?: string;
  description?: string;
  price?: number;
  [key: string]: any;
};

type OrderItem = {
  orderId: string;
  createdAt?: number;
  status?: string;
  total?: number;
  address?: string;
  payments?: string;
  comment?: string;
  paymentStatus?: string;
  items?: {
    dishes?: any[];
    [key: string]: any;
  };
  [key: string]: any;
};

// ─── Firebase Init ─────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCwmWwRCOB8V-u9hgt-pk61pJHFS8BKPJk",
  authDomain: "mamashvili-4d361.firebaseapp.com",
  databaseURL:
    "https://mamashvili-4d361-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mamashvili-4d361",
  storageBucket: "mamashvili-4d361.firebasestorage.app",
  messagingSenderId: "117283386360",
  appId: "1:117283386360:web:748789633778685b0c5c0d",
};
const fbApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(fbApp);
const auth = getAuth(fbApp);
const storage = getStorage(fbApp);

// ─── Подавляем шум reCAPTCHA в dev-оверлее CRA ────────────────────────────────
// Google's recaptcha бросает внутренние исключения которые CRA показывает как
// фатальные ошибки. В продакшене этого не происходит. Фильтруем их здесь.
if (typeof window !== "undefined") {
  const _origOnError = window.onerror;
  window.onerror = function (msg, src, line, col, err) {
    if (
      (typeof src === "string" && src.includes("recaptcha")) ||
      (typeof msg === "string" && msg.toLowerCase().includes("recaptcha"))
    ) {
      return true; // подавляем — не показываем оверлей
    }
    return _origOnError ? _origOnError(msg, src, line, col, err) : false;
  };
  const _origUnhandled = window.onunhandledrejection;
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason?.message || e?.reason || "";
    if (typeof msg === "string" && msg.toLowerCase().includes("recaptcha")) {
      e.preventDefault();
    }
  });
}

// ─── Payment Backend URL ───────────────────────────────────────────────────────
// Замените на URL вашего задеплоенного бэкенда
const PAYMENT_API_URL =
  typeof process !== "undefined" && process.env?.REACT_APP_PAYMENT_API_URL
    ? process.env.REACT_APP_PAYMENT_API_URL
    : "http://localhost:4000";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const tg = (n) => Math.round(n).toLocaleString("ru") + " ₸";
const discountedPrice = (item) =>
  item.discount && item.discount > 0
    ? item.price * (1 - item.discount / 100)
    : item.price;

// ─── Constants ─────────────────────────────────────────────────────────────────
const KASPI_PHONE = "+77001234567";
const CATEGORIES = [
  "Все",
  "Хинкали",
  "Хачапури",
  "Мясо",
  "Закуски",
  "Супы",
  "Напитки",
];
const MENU_SEED = [
  {
    name: "Хинкали с мясом",
    nameGe: "ხინკალი",
    category: "Хинкали",
    price: 490,
    emoji: "🥟",
    description: "Сочные хинкали с говядиной и свининой, зелень, специи",
    weight: "130г",
    popular: true,
    available: true,
  },
  {
    name: "Хинкали грибные",
    nameGe: "სოკოს ხინკალი",
    category: "Хинкали",
    price: 450,
    emoji: "🥟",
    description: "Хинкали с белыми грибами и луком",
    weight: "130г",
    veg: true,
    available: true,
  },
  {
    name: "Хинкали с сыром",
    nameGe: "ყველის ხინკალი",
    category: "Хинкали",
    price: 450,
    emoji: "🥟",
    description: "Хинкали со смесью сулугуни и имеретинского сыра",
    weight: "130г",
    veg: true,
    available: true,
  },
  {
    name: "Хачапури по-аджарски",
    nameGe: "აჭარული",
    category: "Хачапури",
    price: 2700,
    emoji: "🫓",
    description: "Лодочка из теста с сулугуни, яйцо, масло",
    weight: "400г",
    popular: true,
    available: true,
  },
  {
    name: "Хачапури имеретинский",
    nameGe: "იმერული",
    category: "Хачапури",
    price: 2200,
    emoji: "🫓",
    description: "Круглый хачапури с имеретинским сыром внутри",
    weight: "350г",
    veg: true,
    available: true,
  },
  {
    name: "Хачапури мегрельский",
    nameGe: "მეგრული",
    category: "Хачапури",
    price: 2500,
    emoji: "🫓",
    description: "Двойной сыр — внутри и снаружи, запечённый",
    weight: "380г",
    veg: true,
    available: true,
  },
  {
    name: "Мцвади",
    nameGe: "მწვადი",
    category: "Мясо",
    price: 4300,
    emoji: "🍢",
    description: "Шашлык из говядины на мангале, маринад из граната и трав",
    weight: "300г",
    popular: true,
    available: true,
  },
  {
    name: "Чакапули",
    nameGe: "ჩაქაფული",
    category: "Мясо",
    price: 3800,
    emoji: "🍲",
    description: "Молодая баранина с тархуном, белым вином и ткемали",
    weight: "350г",
    available: true,
  },
  {
    name: "Сациви",
    nameGe: "საცივი",
    category: "Мясо",
    price: 3200,
    emoji: "🍗",
    description: "Курица в грецком орехе с хмели-сунели и чесноком",
    weight: "300г",
    popular: true,
    available: true,
  },
  {
    name: "Пхали ассорти",
    nameGe: "ფხალი",
    category: "Закуски",
    price: 2100,
    emoji: "🥗",
    description: "Шпинат, свёкла, фасоль со специями и грецким орехом",
    weight: "200г",
    veg: true,
    popular: true,
    available: true,
  },
  {
    name: "Аджапсандали",
    nameGe: "აჯაფსანდალი",
    category: "Закуски",
    price: 1900,
    emoji: "🫛",
    description: "Тушёные баклажаны с помидорами, болгарским перцем",
    weight: "250г",
    veg: true,
    spicy: true,
    available: true,
  },
  {
    name: "Бадриджани",
    nameGe: "ბადრიჯანი",
    category: "Закуски",
    price: 2000,
    emoji: "🍆",
    description: "Жареные баклажаны с ореховой начинкой и гранатом",
    weight: "220г",
    veg: true,
    available: true,
  },
  {
    name: "Харчо",
    nameGe: "ხარჩო",
    category: "Супы",
    price: 2300,
    emoji: "🍜",
    description: "Говяжий суп с рисом, грецким орехом и тклапи",
    weight: "350мл",
    spicy: true,
    popular: true,
    available: true,
  },
  {
    name: "Чихиртма",
    nameGe: "ჩიხირთმა",
    category: "Супы",
    price: 2200,
    emoji: "🍲",
    description: "Куриный суп с яйцом, тархуном и лимоном",
    weight: "350мл",
    available: true,
  },
  {
    name: "Вино Саперави",
    nameGe: "საფერავი",
    category: "Напитки",
    price: 3200,
    emoji: "🍷",
    description: "Красное сухое грузинское вино, 150мл",
    weight: "150мл",
    available: true,
  },
  {
    name: "Лимонад домашний",
    nameGe: "ლიმონათი",
    category: "Напитки",
    price: 1200,
    emoji: "🥤",
    description: "Тархун, фейхоа или гранат — на выбор",
    weight: "500мл",
    veg: true,
    available: true,
  },
  {
    name: "Боржоми",
    nameGe: "ბორჯომი",
    category: "Напитки",
    price: 990,
    emoji: "💧",
    description: "Минеральная вода, 500мл",
    weight: "500мл",
    veg: true,
    available: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT SYSTEM — Strategy Pattern + Real Payment Backend
// ═══════════════════════════════════════════════════════════════════════════════

class BasePaymentStrategy {
  options: Record<string, any>;

    getQrUrl(_amount: number) {
      return "";
  }   

  constructor(options: Record<string, any> = {}) {
    if (new.target === BasePaymentStrategy) {
      throw new Error("BasePaymentStrategy — абстрактный класс");
    }
    this.options = options;
  }

  getLabel(): string {
    throw new Error("getLabel() не реализован");
  }

  getDescription(): string {
    return "";
  }

  canProceedDirectly(): boolean {
    return true;
  }

  async pay(_context: any) {
    throw new Error("pay() не реализован");
  }
}

// ─── Наличные ─────────────────────────────────────────────────────────────────
class CashPaymentStrategy extends BasePaymentStrategy {
  getLabel() {
    return "Наличными курьеру";
  }
  getDescription() {
    return "Подготовьте сдачу";
  }
  canProceedDirectly() {
    return true;
  }
  async pay({ submitOrder }) {
    await submitOrder();
  }
}

// ─── Карта курьеру ────────────────────────────────────────────────────────────
class CardPaymentStrategy extends BasePaymentStrategy {
  getLabel() {
    return "Картой курьеру";
  }
  getDescription() {
    return "Visa, Mastercard";
  }
  canProceedDirectly() {
    return true;
  }
  async pay({ submitOrder }) {
    await submitOrder();
  }
}

// ─── Kaspi QR (без бэкенда) ───────────────────────────────────────────────────
class KaspiQRPaymentStrategy extends BasePaymentStrategy {
  getLabel() {
    return "Kaspi Pay (QR-код)";
  }
  getDescription() {
    return "QR-перевод на номер";
  }
  canProceedDirectly() {
    return false;
  }
  async pay({ openModal }) {
    openModal();
  }
  getKaspiUrl(amount) {
    return `kaspi://pay?phone=${encodeURIComponent(
      KASPI_PHONE
    )}&amount=${amount}`;
  }
  getQrUrl(amount) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      this.getKaspiUrl(amount)
    )}`;
  }
}

// ─── Stripe Online ────────────────────────────────────────────────────────────
// Создаёт реальный платёж через бэкенд и перенаправляет на Stripe Checkout.
class StripePaymentStrategy extends BasePaymentStrategy {
  getLabel() {
    return "Stripe (онлайн-оплата)";
  }
  getDescription() {
    return "Visa, Mastercard, Apple Pay";
  }
  canProceedDirectly() {
    return false;
  }

  async pay({ total, orderId, submitOrder, openPaymentRedirect }) {
    // 1. Сначала сохраняем заказ в Firebase со статусом pending_payment
    const savedOrderId = await submitOrder({
      paymentStatus: "pending_payment",
    });
    if (!savedOrderId) return;

    // 2. Создаём платёж на бэкенде
    openPaymentRedirect(savedOrderId, "stripe", total);
  }
}

// ─── Реестр ───────────────────────────────────────────────────────────────────
class PaymentRegistry {
  _registry: Map<string, BasePaymentStrategy>;

  constructor() {
    this._registry = new Map();
  }

  register(key: string, strategy: BasePaymentStrategy) {
    this._registry.set(key, strategy);
    return this;
  }

  get(key: string) {
    const s = this._registry.get(key);
    if (!s) throw new Error(`Стратегия "${key}" не найдена`);
    return s;
  }

  getOptions(): Array<{ key: string; label: string; description: string }> {
    return Array.from(this._registry.entries()).map(([key, s]) => ({
      key,
      label: s.getLabel(),
      description: s.getDescription(),
    }));
  }
}

const paymentRegistry = new PaymentRegistry()
  .register("cash", new CashPaymentStrategy())
  .register("card", new CardPaymentStrategy())
  .register("kaspi", new KaspiQRPaymentStrategy())
  .register("stripe", new StripePaymentStrategy());

class PaymentService {
  registry: PaymentRegistry;

  constructor(registry: PaymentRegistry) {
    this.registry = registry;
  }

  async process(paymentKey: string, context: any) {
    const strategy = this.registry.get(paymentKey);
    await strategy.pay(context);
  }

  getOptions() {
    return this.registry.getOptions();
  }
}

const paymentService = new PaymentService(paymentRegistry);

// ─── Хук: опрос статуса платежа ───────────────────────────────────────────────
// Когда пользователь возвращается со Stripe — опрашиваем бэкенд
// пока статус не станет paid или payment_failed.
function usePaymentPoller({ orderId, onPaid, onFailed }) {
  useEffect(() => {
    if (!orderId) return;
    let active = true;
    let attempts = 0;
    const MAX = 30;

    const poll = async () => {
      if (!active || attempts >= MAX) return;
      attempts++;
      try {
        const res = await fetch(
          `${PAYMENT_API_URL}/api/payment/status/${orderId}`
        );
        if (!res.ok) throw new Error("status error");
        const data = await res.json();
        if (data.paymentStatus === "paid") {
          onPaid();
          return;
        }
        if (data.paymentStatus === "payment_failed") {
          onFailed();
          return;
        }
      } catch {
        /* retry */
      }
      setTimeout(poll, 10_000);
    };

    setTimeout(poll, 2_000);
    return () => {
      active = false;
    };
  }, [orderId, onPaid, onFailed]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function useToast() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  const show = useCallback((text) => {
    setMsg(text);
    setVisible(true);
    setTimeout(() => setVisible(false), 3000);
  }, []);
  return { msg, visible, show };
}

function useFirebaseValue(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      path
        ? onValue(ref(db, path), (snap) => {
            setData(snap.val());
            setLoading(false);
          })
        : (setLoading(false), undefined),
    [path]
  );
  return { data, loading };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function GeorgianFlag({ size = 32 }) {
  const s = size,
    h = Math.round(s * 0.65),
    cx = s / 2,
    cy = h / 2;
  const cw = Math.round(s * 0.075),
    sq = Math.round(s * 0.16),
    gap = Math.round(s * 0.06);
  const crosses = [
    [gap + sq / 2, gap + sq / 2],
    [s - gap - sq / 2, gap + sq / 2],
    [gap + sq / 2, h - gap - sq / 2],
    [s - gap - sq / 2, h - gap - sq / 2],
  ];
  return (
    <svg
      width={s}
      height={h}
      viewBox={`0 0 ${s} ${h}`}
      style={{
        border: "1px solid #ddd",
        borderRadius: 1,
        display: "block",
        flexShrink: 0,
      }}
    >
      <rect width={s} height={h} fill="#fff" />
      <rect x={cx - cw / 2} y={0} width={cw} height={h} fill="#cc0000" />
      <rect x={0} y={cy - cw / 2} width={s} height={cw} fill="#cc0000" />
      {crosses.map(([x, y], i) => (
        <g key={i}>
          <rect
            x={x - sq / 2}
            y={y - cw / 2}
            width={sq}
            height={cw}
            fill="#cc0000"
          />
          <rect
            x={x - cw / 2}
            y={y - sq / 2}
            width={cw}
            height={sq}
            fill="#cc0000"
          />
        </g>
      ))}
    </svg>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #e8ddd0",
          borderTopColor: "#cc0000",
          borderRadius: "50%",
          animation: "spin .8s linear infinite",
          margin: "0 auto",
        }}
      />
    </div>
  );
}

// ─── Бейдж статуса оплаты ─────────────────────────────────────────────────────
function PaymentStatusBadge({ status }) {
  const configs = {
    pending_payment: {
      label: "Ожидает оплаты",
      bg: "#fff3cd",
      color: "#856404",
      border: "#ffc107",
    },
    paid: {
      label: "Оплачено ✓",
      bg: "#e6ffe6",
      color: "#006600",
      border: "#44bb44",
    },
    payment_failed: {
      label: "Ошибка оплаты",
      bg: "#ffe6e6",
      color: "#cc0000",
      border: "#ff4444",
    },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  return (
    <span
      style={{
        padding: "3px 10px",
        fontSize: 9,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontWeight: 800,
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        display: "inline-block",
        marginLeft: 8,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Kaspi Modal ──────────────────────────────────────────────────────────────
function KaspiModal({ amount, onConfirm, onClose }) {
  const kaspiStrategy = paymentRegistry.get("kaspi");
  const qrUrl = kaspiStrategy.getQrUrl(amount);
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.7)",
        zIndex: 250,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 380,
          textAlign: "center",
          margin: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,.2)",
        }}
      >
        <div
          style={{
            background: "#f14635",
            color: "#fff",
            fontWeight: 900,
            fontSize: 18,
            padding: "4px 12px",
            borderRadius: 6,
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          Kaspi
        </div>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 26,
            fontWeight: 700,
            color: "#1a1a1a",
            marginBottom: 4,
          }}
        >
          Оплата через Kaspi
        </div>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 36,
            fontWeight: 700,
            color: "#f14635",
            marginBottom: 6,
          }}
        >
          {tg(amount)}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            letterSpacing: 1,
            marginBottom: 20,
            textTransform: "uppercase",
          }}
        >
          Отсканируйте QR или переведите вручную
        </div>
        <div
          style={{
            background: "#fafafa",
            border: "2px solid #eee",
            borderRadius: 8,
            padding: 16,
            display: "inline-flex",
            marginBottom: 16,
          }}
        >
          <img
            src={qrUrl}
            width={180}
            height={180}
            alt="Kaspi QR"
            style={{ display: "block", borderRadius: 4 }}
          />
        </div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
          Переводите на номер:
          <br />
          <strong style={{ color: "#f14635", fontSize: 16 }}>
            {KASPI_PHONE}
          </strong>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#aaa",
            letterSpacing: 1,
            marginBottom: 24,
          }}
        >
          Укажите сумму точно: {tg(amount)}
        </div>
        <button
          onClick={onConfirm}
          style={{
            width: "100%",
            background: "#f14635",
            color: "#fff",
            border: "none",
            padding: 13,
            fontFamily: "inherit",
            fontSize: 11,
            letterSpacing: 2,
            fontWeight: 700,
            cursor: "pointer",
            textTransform: "uppercase",
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          ✓ Оплатил — оформить заказ
        </button>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            background: "none",
            color: "#aaa",
            border: "1px solid #eee",
            padding: 11,
            fontFamily: "inherit",
            fontSize: 11,
            letterSpacing: 2,
            cursor: "pointer",
            textTransform: "uppercase",
            borderRadius: 6,
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// ─── Payment Redirect Modal ───────────────────────────────────────────────────
// Показывается пока создаётся платёж и идёт редирект на Stripe/PayPal
function PaymentRedirectModal({ loading, error, onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.7)",
        zIndex: 250,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "44px 36px",
          width: "100%",
          maxWidth: 360,
          textAlign: "center",
          margin: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,.2)",
        }}
      >
        {error ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 22,
                color: "#cc0000",
                marginBottom: 12,
              }}
            >
              Ошибка оплаты
            </div>
            <div style={{ fontSize: 13, color: "#8a6a50", marginBottom: 24 }}>
              {error}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "#cc0000",
                color: "#fff",
                border: "none",
                padding: "12px 32px",
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: 2,
                cursor: "pointer",
                textTransform: "uppercase",
                fontWeight: 700,
                borderRadius: 2,
              }}
            >
              Закрыть
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                border: "4px solid #e8ddd0",
                borderTopColor: "#cc0000",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 22,
                color: "#1a0a00",
                marginBottom: 8,
              }}
            >
              Создаём платёж…
            </div>
            <div style={{ fontSize: 12, color: "#8a6a50", letterSpacing: 1 }}>
              Сейчас вы будете перенаправлены на страницу оплаты
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Save user profile to Firebase ───────────────────────────────────────────
// ─── Helpers: phone → fake email для Firebase Email Auth ─────────────────────
// Firebase Email/Password требует email. Конвертируем номер телефона в
// уникальный псевдо-email, который хранится только у нас.
function phoneToEmail(phone) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@mamashvili.app`;
}

// ─── Сохраняем профиль пользователя в Firebase Realtime DB ────────────────────
async function saveUserProfile(
  user: any,
  extraData: {
    phone?: string;
    displayName?: string;
    provider?: string;
  } = {}
) {
  try {
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);
    const now = Date.now();
    if (!snap.exists()) {
      await set(userRef, {
        uid: user.uid,
        phone: user.phoneNumber || extraData.phone || null,
        email: user.email || null,
        displayName: user.displayName || extraData.displayName || null,
        photoURL: user.photoURL || null,
        provider: extraData.provider || "email",
        createdAt: now,
        lastLoginAt: now,
      });
    } else {
      await set(userRef, {
        ...snap.val(),
        lastLoginAt: now,
        ...(extraData.phone ? { phone: extraData.phone } : {}),
      });
    }
  } catch (e) {
    console.warn("saveUserProfile error:", e);
  }
}

// ─── Ищем пользователя по номеру телефона в БД ────────────────────────────────
async function findUserByPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const usersRef = ref(db, "users");
  const snap = await get(usersRef);
  if (!snap.exists()) return null;

  const users = snap.val() as Record<string, { phone?: string; [key: string]: any }>;

  return (
    Object.values(users).find(
      (u) => u.phone && u.phone.replace(/\D/g, "") === digits
    ) || null
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
// ─── Shared Auth Styles ───────────────────────────────────────────────────────
const authInputStyle: CSSProperties = {
  background: "#fafafa",
  border: "1px solid #e8ddd0",
  color: "#1a0a00",
  padding: "12px 13px",
  fontFamily: "Raleway,sans-serif",
  fontSize: 14,
  outline: "none",
  borderRadius: 4,
  width: "100%",
  boxSizing: "border-box",
};
const authLabelStyle = {
  fontSize: 9,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#8a6a50",
  fontWeight: 600,
};

function AuthPrimaryBtn({ label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#e0d0c8" : "#cc0000",
        color: "#fff",
        border: "none",
        padding: "14px 20px",
        fontFamily: "Raleway,sans-serif",
        fontSize: 12,
        letterSpacing: 2,
        cursor: disabled ? "default" : "pointer",
        textTransform: "uppercase",
        fontWeight: 700,
        borderRadius: 4,
        width: "100%",
      }}
    >
      {label}
    </button>
  );
}

function AuthLinkBtn({ label, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        color: "#cc0000",
        fontSize: 11,
        cursor: "pointer",
        letterSpacing: 1,
        textDecoration: "underline",
      }}
    >
      {label}
    </span>
  );
}

function AuthErrorBox({ error }) {
  if (!error) return null;
  return (
    <div
      style={{
        background: "#fff0f0",
        border: "1px solid #ffdddd",
        color: "#cc0000",
        padding: "10px 14px",
        fontSize: 11,
        borderRadius: 4,
      }}
    >
      {error}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  show,
  onToggle,
  onEnter,
}: {
  value: string;
  onChange: (e: any) => void;
  placeholder?: string;
  show: boolean;
  onToggle: () => void;
  onEnter?: () => void | Promise<void>;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder || "••••••••"}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        style={{ ...authInputStyle, paddingRight: 44 }}
        autoComplete="new-password"
      />
      <span
        onClick={onToggle}
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          cursor: "pointer",
          fontSize: 16,
          color: "#8a6a50",
          userSelect: "none",
        }}
      >
        {show ? "🙈" : "👁️"}
      </span>
    </div>
  );
}

function AuthModal({ onClose, toast }) {
  // mode: "login" | "register" | "forgot"
  const [mode, setMode] = useState("login");
  const [phone, setPhone] = useState("+7");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  // forgot: старый пароль + новый пароль
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showNewPass2, setShowNewPass2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (m) => {
    setMode(m);
    setError("");
    setPassword("");
    setPassword2("");
    setOldPass("");
    setNewPass("");
    setNewPass2("");
  };

  // ── Вход по телефону + пароль ──────────────────────────────────────────────
  const handleLogin = async () => {
    if (phone.replace(/\D/g, "").length < 11) {
      setError("Введи номер в формате +7XXXXXXXXXX");
      return;
    }
    if (!password) {
      setError("Введи пароль");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const email = phoneToEmail(phone);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await saveUserProfile(result.user, { phone, provider: "phone" });
      toast("Добро пожаловать! 🇬🇪");
      onClose();
    } catch (e) {
      const msg =
        e.code === "auth/invalid-credential" ||
        e.code === "auth/wrong-password" ||
        e.code === "auth/user-not-found"
          ? "Неверный номер или пароль"
          : e.code === "auth/too-many-requests"
          ? "Слишком много попыток. Попробуй позже."
          : e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Регистрация по телефону + пароль ──────────────────────────────────────
  const handleRegister = async () => {
    if (phone.replace(/\D/g, "").length < 11) {
      setError("Введи номер в формате +7XXXXXXXXXX");
      return;
    }
    if (password.length < 6) {
      setError("Пароль минимум 6 символов");
      return;
    }
    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const existing = await findUserByPhone(phone);
      if (existing) {
        setError("Этот номер уже зарегистрирован");
        setLoading(false);
        return;
      }
      const email = phoneToEmail(phone);
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await updateProfile(result.user, { displayName: phone });
      await saveUserProfile(result.user, { phone, provider: "phone" });
      toast("Аккаунт создан! Добро пожаловать 🇬🇪");
      onClose();
    } catch (e) {
      const msg =
        e.code === "auth/email-already-in-use"
          ? "Этот номер уже зарегистрирован"
          : e.code === "auth/weak-password"
          ? "Пароль слишком слабый"
          : e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Google ─────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await saveUserProfile(result.user, { provider: "google" });
      toast("Добро пожаловать! 🇬🇪");
      onClose();
    } catch (e) {
      setError(
        e.code === "auth/popup-closed-by-user" ? "Окно закрыто." : e.message
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Смена пароля: старый пароль → новый пароль (без SMS!) ─────────────────
  const handleChangePassword = async () => {
    if (phone.replace(/\D/g, "").length < 11) {
      setError("Введи номер в формате +7XXXXXXXXXX");
      return;
    }
    if (!oldPass) {
      setError("Введи текущий пароль");
      return;
    }
    if (newPass.length < 6) {
      setError("Новый пароль минимум 6 символов");
      return;
    }
    if (newPass !== newPass2) {
      setError("Новые пароли не совпадают");
      return;
    }
    if (oldPass === newPass) {
      setError("Новый пароль совпадает со старым");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const email = phoneToEmail(phone);
      // 1. Входим со старым паролем чтобы получить credential
      const credential = EmailAuthProvider.credential(email, oldPass);
      // 2. Re-authenticate
      await reauthenticateWithCredential(
        auth.currentUser ||
          (
            await signInWithEmailAndPassword(auth, email, oldPass)
          ).user,
        credential
      );
      // 3. Меняем пароль
      await updatePassword(auth.currentUser, newPass);
      await saveUserProfile(auth.currentUser, { phone, provider: "phone" });
      toast("Пароль успешно изменён! 🇬🇪");
      onClose();
    } catch (e) {
      const msg =
        e.code === "auth/invalid-credential" || e.code === "auth/wrong-password"
          ? "Неверный текущий пароль"
          : e.code === "auth/user-not-found"
          ? "Аккаунт с таким номером не найден"
          : e.code === "auth/too-many-requests"
          ? "Слишком много попыток. Попробуй позже."
          : e.code === "auth/requires-recent-login"
          ? "Сначала войди в аккаунт заново"
          : e.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Стили ──────────────────────────────────────────────────────────────────

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderTop: "4px solid #cc0000",
          boxShadow: "0 24px 80px rgba(0,0,0,.2)",
          width: "100%",
          maxWidth: 400,
          padding: "36px 32px 32px",
          position: "relative",
          borderRadius: 8,
          margin: 16,
          animation: "slideIn .3s ease",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Закрыть */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            background: "none",
            border: "none",
            color: "#8a6a50",
            fontSize: 20,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* Заголовок */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#1a0a00",
              marginBottom: 4,
            }}
          >
            {mode === "login"
              ? "Войти"
              : mode === "register"
              ? "Регистрация"
              : "Восстановление"}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#8a6a50",
            }}
          >
            Ресторан Мамашвили
          </div>
        </div>

        {/* ── ВХОД ── */}
        {mode === "login" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Номер телефона</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="+77001234567"
                style={authInputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Пароль</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                show={showPass}
                onToggle={() => setShowPass(!showPass)}
                onEnter={handleLogin}
              />
            </div>
            {<AuthErrorBox error={error} />}
            <AuthPrimaryBtn
              label={loading ? "Входим..." : "Войти"}
              onClick={handleLogin}
              disabled={loading}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 2,
              }}
            >
              <AuthLinkBtn
                label="Забыл пароль"
                onClick={() => switchMode("forgot")}
              />
              <AuthLinkBtn
                label="Создать аккаунт"
                onClick={() => switchMode("register")}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "4px 0",
              }}
            >
              <div style={{ flex: 1, height: 1, background: "#e8ddd0" }} />
              <span
                style={{ fontSize: 10, color: "#8a6a50", letterSpacing: 1 }}
              >
                ИЛИ
              </span>
              <div style={{ flex: 1, height: 1, background: "#e8ddd0" }} />
            </div>
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                background: "#fff",
                border: "2px solid #e8ddd0",
                color: "#1a0a00",
                padding: "12px 20px",
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: 1,
                cursor: "pointer",
                borderRadius: 4,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Войти через Google
            </button>
          </div>
        )}

        {/* ── РЕГИСТРАЦИЯ ── */}
        {mode === "register" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Номер телефона</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+77001234567"
                style={authInputStyle}
              />
              <span style={{ fontSize: 9, color: "#8a6a50", letterSpacing: 1 }}>
                Формат: +7XXXXXXXXXX
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Пароль</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                show={showPass}
                onToggle={() => setShowPass(!showPass)}
                onEnter={handleRegister}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Повторить пароль</label>
              <PasswordInput
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                show={showPass2}
                onToggle={() => setShowPass2(!showPass2)}
                onEnter={handleRegister}
              />
            </div>
            {<AuthErrorBox error={error} />}
            <AuthPrimaryBtn
              label={loading ? "Создаём..." : "Создать аккаунт"}
              onClick={handleRegister}
              disabled={loading}
            />
            <div style={{ textAlign: "center" }}>
              <AuthLinkBtn
                label="Уже есть аккаунт? Войти"
                onClick={() => switchMode("login")}
              />
            </div>
          </div>
        )}

        {/* ── СМЕНА ПАРОЛЯ ── */}
        {mode === "forgot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p
              style={{
                fontSize: 12,
                color: "#8a6a50",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Введи номер телефона, текущий пароль и новый пароль.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Номер телефона</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+77001234567"
                style={authInputStyle}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Текущий пароль</label>
              <PasswordInput
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                placeholder="Текущий пароль"
                show={showOldPass}
                onToggle={() => setShowOldPass(!showOldPass)}
                onEnter={handleChangePassword}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Новый пароль</label>
              <PasswordInput
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Минимум 6 символов"
                show={showNewPass}
                onToggle={() => setShowNewPass(!showNewPass)}
                onEnter={handleChangePassword}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={authLabelStyle}>Повторить новый пароль</label>
              <PasswordInput
                value={newPass2}
                onChange={(e) => setNewPass2(e.target.value)}
                show={showNewPass2}
                onToggle={() => setShowNewPass2(!showNewPass2)}
                onEnter={handleChangePassword}
              />
            </div>
            {<AuthErrorBox error={error} />}
            <AuthPrimaryBtn
              label={loading ? "Сохраняем..." : "Изменить пароль"}
              onClick={handleChangePassword}
              disabled={loading}
            />
            <div style={{ textAlign: "center" }}>
              <AuthLinkBtn
                label="← Назад"
                onClick={() => switchMode("login")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────
// ─── Хук: загружает фото из Firebase Storage и листает слайды ────────────────
function useSlideshow(folder = "") {
  const [urls, setUrls] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const folderRef = sRef(storage, folder);
    listAll(folderRef)
      .then((res) => {
        const items = res.items.length > 0 ? res.items : res.prefixes;
        // Если папка пустая — пробуем корень
        const targets = res.items.length > 0 ? res.items : [];
        if (targets.length === 0 && res.prefixes.length === 0) {
          // Попробуем корень хранилища
          return listAll(sRef(storage, "")).then((r) =>
            Promise.all(r.items.map((i) => getDownloadURL(i)))
          );
        }
        return Promise.all(targets.map((i) => getDownloadURL(i)));
      })
      .then((downloadUrls) => {
        const valid = downloadUrls.filter(Boolean);
        if (valid.length > 0) {
          setUrls(valid);
          setLoaded(true);
        }
      })
      .catch((e) => console.warn("Storage load error:", e));
  }, [folder]);

  useEffect(() => {
    if (urls.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % urls.length), 5000);
    return () => clearInterval(id);
  }, [urls.length]);

  return { urls, idx, setIdx, loaded };
}

// ─── Компонент слайдшоу ───────────────────────────────────────────────────────
function HeroSlideshow() {
  const { urls, idx, setIdx, loaded } = useSlideshow("");

  if (!loaded || urls.length === 0) {
    // Фолбэк — градиентный фон пока фото не загрузились
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #1a0a00 100%)",
        }}
      />
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {urls.map((url, i) => (
        <div
          key={url}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: i === idx ? 1 : 0,
            transition: "opacity 1.2s ease-in-out",
          }}
        />
      ))}
      {/* Тёмный оверлей для читаемости текста */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(26,10,0,.72) 0%, rgba(26,10,0,.45) 60%, rgba(26,10,0,.6) 100%)",
        }}
      />
      {/* Точки-навигаторы */}
      {urls.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
            zIndex: 2,
          }}
        >
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: i === idx ? "#cc0000" : "rgba(255,255,255,.5)",
                transition: "all .3s",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HomePage({ onMenu, onLogin, user }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Слайдшоу на фоне */}
      <HeroSlideshow />

      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "80px 40px",
          display: "flex",
          gap: 60,
          alignItems: "center",
          flexWrap: "wrap",
          position: "relative",
          zIndex: 1,
          width: "100%",
        }}
      >
        <div style={{ flex: 1, zIndex: 1, minWidth: 280 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(204,0,0,.25)",
              border: "1px solid rgba(204,0,0,.5)",
              padding: "6px 16px",
              marginBottom: 24,
              borderRadius: 2,
              backdropFilter: "blur(8px)",
            }}
          >
            <GeorgianFlag size={24} />
            <span
              style={{
                fontSize: 10,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: "#ffaaaa",
                fontWeight: 700,
              }}
            >
              Грузинская кухня · Тбилиси
            </span>
          </div>
          <h1
            style={{
              fontFamily: "Georgia,serif",
              fontSize: "clamp(56px,7vw,100px)",
              lineHeight: 0.9,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 10,
              textShadow: "0 2px 20px rgba(0,0,0,.4)",
            }}
          >
            მამაშვილი
            <br />
            <span style={{ color: "#cc0000" }}>Мамашвили</span>
          </h1>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: "clamp(16px,2vw,24px)",
              color: "rgba(255,220,200,.85)",
              fontStyle: "italic",
              marginBottom: 24,
              letterSpacing: 2,
            }}
          >
            სახლის სამზარეულო · Домашняя кухня
          </div>
          <p
            style={{
              color: "rgba(255,235,220,.85)",
              fontSize: 15,
              lineHeight: 1.8,
              maxWidth: 480,
              marginBottom: 44,
            }}
          >
            Хинкали, хачапури, мцвади — блюда, которые готовили веками в горах
            Кавказа. Доставка горячими прямо к вам.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button
              onClick={onMenu}
              style={{
                background: "#cc0000",
                color: "#fff",
                border: "none",
                padding: "15px 40px",
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: 3,
                cursor: "pointer",
                textTransform: "uppercase",
                fontWeight: 700,
                borderRadius: 2,
              }}
            >
              Заказать сейчас →
            </button>
            {!user && (
              <button
                onClick={onLogin}
                style={{
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,.6)",
                  padding: "13px 36px",
                  fontFamily: "inherit",
                  fontSize: 11,
                  letterSpacing: 3,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  borderRadius: 2,
                  background: "rgba(255,255,255,.08)",
                  backdropFilter: "blur(4px)",
                }}
              >
                Войти в аккаунт
              </button>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 40,
              marginTop: 56,
              paddingTop: 40,
              borderTop: "1px solid #e8ddd0",
              flexWrap: "wrap",
            }}
          >
            {[
              { num: "4.9★", lbl: "Рейтинг" },
              { num: "45мин", lbl: "Доставка" },
              { num: "18+", lbl: "Блюд" },
            ].map((s, i) => (
              <div key={i}>
                <div
                  style={{
                    fontFamily: "Georgia,serif",
                    fontSize: 44,
                    fontWeight: 700,
                    color: "#cc0000",
                    lineHeight: 1,
                  }}
                >
                  {s.num}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "#8a6a50",
                    marginTop: 4,
                  }}
                >
                  {s.lbl}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            maxWidth: 460,
            flex: 1,
          }}
        >
          {[
            { e: "🥟", n: "Хинкали", g: "ხინკალი", p: "от 450 ₸" },
            { e: "🫓", n: "Хачапури", g: "ხაჭაპური", p: "от 2 200 ₸" },
            { e: "🍢", n: "Мцвади", g: "მწვადი", p: "4 300 ₸" },
            { e: "🥗", n: "Пхали", g: "ფხალი", p: "2 100 ₸" },
          ].map((d, i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.2)",
                backdropFilter: "blur(12px)",
                padding: "22px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                position: "relative",
                overflow: "hidden",
                aspectRatio: ".88",
                borderRadius: 8,
                marginTop: i === 0 ? 28 : i === 2 ? -28 : 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 52,
                  opacity: 0.1,
                }}
              >
                {d.e}
              </div>
              <div
                style={{
                  fontFamily: "Georgia,serif",
                  fontSize: 11,
                  fontStyle: "italic",
                  color: "#cc0000",
                  position: "relative",
                  marginBottom: 2,
                }}
              >
                {d.g}
              </div>
              <div
                style={{
                  fontFamily: "Georgia,serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#1a0a00",
                  position: "relative",
                }}
              >
                {d.n}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#8a6a50",
                  position: "relative",
                  marginTop: 4,
                }}
              >
                {d.p}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuPage({ user, onAddToCart, toast, onLogin }) {
  const { data, loading } = useFirebaseValue("menu");
  const [cat, setCat] = useState("Все");

  useEffect(() => {
    if (!loading && data === null)
      MENU_SEED.forEach((d) =>
        push(ref(db, "menu"), { ...d, createdAt: Date.now() })
      );
  }, [loading, data]);

  const items: Dish[] = data
    ? Object.entries(data as Record<string, any>)
        .map(([id, v]) => ({ id, ...(v as Record<string, any>) } as Dish))
        .filter((d) => d.available !== false)
    : [];
  const filtered =
    cat === "Все" ? items : items.filter((d) => d.category === cat);

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "60px 40px" }}>
      <div
        style={{
          marginBottom: 40,
          paddingBottom: 24,
          borderBottom: "2px solid #cc0000",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 52,
              fontWeight: 700,
              color: "#1a0a00",
            }}
          >
            Меню <span style={{ color: "#cc0000" }}>Мамашвили</span>
          </div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 16,
              fontStyle: "italic",
              color: "#8a6a50",
              marginTop: 4,
            }}
          >
            Традиционная грузинская кухня
          </div>
        </div>
        <GeorgianFlag size={32} />
      </div>
      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 40 }}
      >
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              background: cat === c ? "#cc0000" : "#fff",
              border: `1px solid ${cat === c ? "#cc0000" : "#e8ddd0"}`,
              color: cat === c ? "#fff" : "#8a6a50",
              padding: "8px 20px",
              fontFamily: "inherit",
              fontSize: 10,
              letterSpacing: 2,
              cursor: "pointer",
              textTransform: "uppercase",
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))",
            gap: 16,
          }}
        >
          {filtered.map((dish) => {
            const finalPrice = discountedPrice(dish);
            const hasDisc = dish.discount && dish.discount > 0;
            return (
              <div
                key={dish.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e8ddd0",
                  borderRadius: 4,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: 180,
                    background: "linear-gradient(135deg,#fff5f5,#fff)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    borderBottom: "1px solid #e8ddd0",
                  }}
                >
                  {dish.imageUrl ? (
                    <img
                      src={dish.imageUrl}
                      alt={dish.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        position: "absolute",
                        inset: 0,
                      }}
                      onError={(e) => {
  e.currentTarget.style.display = "none";
}}
                    />
                  ) : null}
                  {!dish.imageUrl && (
                    <span
                      style={{ fontSize: 68, position: "relative", zIndex: 1 }}
                    >
                      {dish.emoji}
                    </span>
                  )}
                  {hasDisc && (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: -24,
                        background: "#cc0000",
                        color: "#fff",
                        padding: "4px 32px 4px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 1,
                        zIndex: 2,
                      }}
                    >
                      −{dish.discount}%
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      display: "flex",
                      gap: 4,
                      zIndex: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    {dish.popular && (
                      <span
                        style={{
                          background: "#daa520",
                          color: "#fff",
                          padding: "2px 8px",
                          fontSize: 8,
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                          fontWeight: 700,
                          borderRadius: 2,
                        }}
                      >
                        ★ Хит
                      </span>
                    )}
                    {dish.spicy && (
                      <span
                        style={{
                          background: "#ff6600",
                          color: "#fff",
                          padding: "2px 8px",
                          fontSize: 8,
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                          fontWeight: 700,
                          borderRadius: 2,
                        }}
                      >
                        🌶
                      </span>
                    )}
                    {dish.veg && (
                      <span
                        style={{
                          background: "#228833",
                          color: "#fff",
                          padding: "2px 8px",
                          fontSize: 8,
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                          fontWeight: 700,
                          borderRadius: 2,
                        }}
                      >
                        🌿
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    padding: "16px 18px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 3,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Georgia,serif",
                        fontSize: 19,
                        fontWeight: 700,
                        color: "#1a0a00",
                        lineHeight: 1.2,
                        flex: 1,
                      }}
                    >
                      {dish.name}
                    </div>
                    {dish.weight && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "#b8987a",
                          letterSpacing: 1,
                          whiteSpace: "nowrap",
                          paddingLeft: 8,
                          paddingTop: 3,
                        }}
                      >
                        {dish.weight}
                      </div>
                    )}
                  </div>
                  {dish.nameGe && (
                    <div
                      style={{
                        fontFamily: "Georgia,serif",
                        fontSize: 12,
                        fontStyle: "italic",
                        color: "#cc0000",
                        marginBottom: 8,
                      }}
                    >
                      {dish.nameGe}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "#8a6a50",
                      lineHeight: 1.7,
                      flex: 1,
                      marginBottom: 14,
                    }}
                  >
                    {dish.description}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "auto",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "Georgia,serif",
                          fontSize: 24,
                          fontWeight: 700,
                          color: "#cc0000",
                          lineHeight: 1,
                        }}
                      >
                        {tg(finalPrice)}
                      </div>
                      {hasDisc && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#b8987a",
                            textDecoration: "line-through",
                            marginTop: 1,
                          }}
                        >
                          {tg(dish.price)}
                        </div>
                      )}
                    </div>
                    {user ? (
                      <button
                        onClick={() => {
                          onAddToCart({ ...dish, price: finalPrice });
                          toast(`${dish.name} — в корзину!`);
                        }}
                        style={{
                          background: "#cc0000",
                          color: "#fff",
                          border: "none",
                          padding: "10px 18px",
                          fontFamily: "inherit",
                          fontSize: 10,
                          letterSpacing: 2,
                          cursor: "pointer",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          borderRadius: 2,
                          whiteSpace: "nowrap",
                        }}
                      >
                        В корзину
                      </button>
                    ) : (
                      <button
                        onClick={onLogin}
                        style={{
                          background: "none",
                          border: "1px solid #d4c4b0",
                          color: "#8a6a50",
                          padding: "10px 14px",
                          fontFamily: "inherit",
                          fontSize: 9,
                          letterSpacing: 1,
                          cursor: "pointer",
                          textTransform: "uppercase",
                          borderRadius: 2,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Войти
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CartPage ─────────────────────────────────────────────────────────────────
function CartPage({ cart, setCart, toast, onOrderDone, user, onLogin }) {
  const [form, setForm] = useState({
    name: user?.displayName || "",
    phone: user?.phoneNumber || "",
    address: "",
    comment: "",
    payment: "cash",
  });
  const [showKaspi, setShowKaspi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Для Stripe: показывать модалку редиректа
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [redirectError, setRedirectError] = useState("");
  // orderId заказа, который ждёт оплаты (для поллинга)
  const [pendingOrderId, setPendingOrderId] = useState(null);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      name: user?.displayName || f.name,
      phone: user?.phoneNumber || f.phone,
    }));
  }, [user]);

  // Проверяем: вернулся ли пользователь после оплаты Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedOrderId = params.get("orderId");
    const status = params.get("paymentStatus");

    if (returnedOrderId && status === "success") {
      setPendingOrderId(returnedOrderId);
      toast("Проверяем оплату… ⏳");
      // Чистим URL
      const url = new URL(window.location.href);
      url.searchParams.delete("orderId");
      url.searchParams.delete("paymentStatus");
      window.history.replaceState({}, "", url.toString());
    }
  }, [toast]);

  // Поллинг статуса после возврата со Stripe
  usePaymentPoller({
    orderId: pendingOrderId,
    onPaid: useCallback(() => {
      toast("Оплата прошла! Готовим для вас 🍷");
      setCart([]);
      setPendingOrderId(null);
      setTimeout(onOrderDone, 1400);
    }, [toast, setCart, onOrderDone]),
    onFailed: useCallback(() => {
      toast("Оплата не прошла. Попробуйте снова.");
      setPendingOrderId(null);
    }, [toast]),
  });

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryCost = subtotal >= 20000 ? 0 : 1200;
  const total = subtotal + deliveryCost;

  const change = (qty, idx) =>
    setCart((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, qty: Math.max(1, it.qty + qty) } : it
      )
    );
  const remove = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  /**
   * Сохраняет заказ в Firebase.
   * @param {object} extraFields — доп. поля (например { paymentStatus: "pending_payment" })
   * @returns {string|null} orderId или null при ошибке
   */
  const submitOrder = async (extraFields = {}) => {
    if (!user) return null;
    setSubmitting(true);
    try {
      await set(ref(db, `users/${user.uid}`), {
        name: form.name,
        phone: form.phone,
        email: user.email || "",
        address: form.address,
        createdAt: Date.now(),
        authProvider: user.providerData[0]?.providerId || "unknown",
      });

      const orderData = {
        uid: user.uid,
        userName: form.name,
        phone: form.phone,
        address: form.address,
        comment: form.comment,
        payments: form.payment,
        status: "new",
        // Статус оплаты: для наличных/карты — paid сразу, для онлайн — pending
        paymentStatus: form.payment === "stripe" ? "pending_payment" : "paid",
        paymentProvider: form.payment,
        total,
        createdAt: Date.now(),
        items: {
          dishes: cart.map((i) => ({
            dishId: i.id,
            name: i.name,
            price: i.price,
            qty: i.qty,
            subtotal: i.price * i.qty,
          })),
        },
        ...extraFields,
      };

      const userOrderRef = push(ref(db, `users/${user.uid}/orders`));
      await set(userOrderRef, orderData);
      await set(ref(db, `orders/${userOrderRef.key}`), orderData);

      return userOrderRef.key;
    } catch (err) {
      toast("Ошибка сохранения заказа");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Создаёт онлайн-платёж через бэкенд и редиректит на Stripe.
   */
  const openPaymentRedirect = async (orderId, provider, amount) => {
    setShowRedirectModal(true);
    setRedirectError("");
    try {
      const res = await fetch(`${PAYMENT_API_URL}/api/payment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          orderId,
          amount,
          currency: "KZT",
          description: `Заказ Мамашвили — ${cart.length} позиц.`,
          returnUrl:
            window.location.origin +
            window.location.pathname +
            "?paymentStatus=success",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания платежа");
      window.location.href = data.paymentUrl;
    } catch (err) {
      setRedirectError(err.message);
    }
  };

  const placeOrder = async () => {
    if (!user) {
      onLogin();
      return;
    }
    if (!form.name || !form.address) {
      toast("Укажи имя и адрес доставки");
      return;
    }

    await paymentService.process(form.payment, {
      total,
      form,
      cart,
      user,
      // Для наличных/карты: сохраняем заказ и идём на страницу заказов
      submitOrder: async (extraFields) => {
        const orderId = await submitOrder(extraFields);
        if (orderId && form.payment !== "stripe") {
          toast("Заказ принят! Готовим для вас 🍷");
          setCart([]);
          setTimeout(onOrderDone, 1400);
        }
        return orderId;
      },
      // Для Kaspi QR
      openModal: () => setShowKaspi(true),
      closeModal: () => setShowKaspi(false),
      // Для Stripe
      openPaymentRedirect,
    });
  };

  const inputStyle = {
    background: "#fafafa",
    border: "1px solid #e8ddd0",
    color: "#1a0a00",
    padding: "10px 13px",
    fontFamily: "inherit",
    fontSize: 13,
    outline: "none",
    borderRadius: 2,
    width: "100%",
  };
  const labelStyle = {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#8a6a50",
    fontWeight: 600,
  };

  if (cart.length === 0)
    return (
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "60px 40px" }}>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 52,
            fontWeight: 700,
            color: "#1a0a00",
            marginBottom: 40,
            paddingBottom: 24,
            borderBottom: "2px solid #cc0000",
          }}
        >
          Корзина
        </div>
        <div style={{ textAlign: "center", padding: "100px 40px" }}>
          <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.2 }}>🛒</div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 28,
              color: "#1a0a00",
              marginBottom: 8,
            }}
          >
            Корзина пуста
          </div>
          <div style={{ color: "#8a6a50", fontSize: 13 }}>
            Добавьте блюда из нашего меню
          </div>
        </div>
      </div>
    );

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "60px 40px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 40,
          paddingBottom: 24,
          borderBottom: "2px solid #cc0000",
        }}
      >
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 52,
            fontWeight: 700,
            color: "#1a0a00",
          }}
        >
          Корзина
        </div>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 28,
            color: "#cc0000",
          }}
        >
          {tg(total)}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          gap: 40,
          alignItems: "start",
        }}
      >
        <div>
          {cart.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "64px 1fr auto",
                gap: 16,
                alignItems: "center",
                borderBottom: "1px solid #e8ddd0",
                padding: "18px 0",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: "#fff0f0",
                  border: "1px solid #e8ddd0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onError={(e) => {
  e.currentTarget.style.display = "none";
}}
                  />
                ) : (
                  item.emoji
                )}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "Georgia,serif",
                    fontSize: 17,
                    fontWeight: 700,
                    color: "#1a0a00",
                    marginBottom: 3,
                  }}
                >
                  {item.name}
                </div>
                <div style={{ fontSize: 12, color: "#8a6a50" }}>
                  {tg(item.price)} за порцию
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  {[-1, 1].map((d) => (
                    <button
                      key={d}
                      onClick={() => change(d, idx)}
                      style={{
                        width: 28,
                        height: 28,
                        background: "#e8ddd0",
                        border: "none",
                        color: "#1a0a00",
                        cursor: "pointer",
                        fontSize: 15,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 2,
                      }}
                    >
                      {d < 0 ? "−" : "+"}
                    </button>
                  ))}
                  <span
                    style={{
                      fontSize: 14,
                      minWidth: 24,
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {item.qty}
                  </span>
                  <span style={{ fontSize: 11, color: "#8a6a50" }}>
                    = {tg(item.price * item.qty)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => remove(idx)}
                style={{
                  background: "none",
                  border: "1px solid #e0d0d0",
                  color: "#c09090",
                  padding: "7px 12px",
                  cursor: "pointer",
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                  borderRadius: 2,
                }}
              >
                Убрать
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e8ddd0",
            borderTop: "3px solid #cc0000",
            padding: 28,
            position: "sticky",
            top: 80,
            borderRadius: 2,
          }}
        >
          {!user && (
            <div
              style={{
                background: "#fff0f0",
                border: "1px solid #ffdddd",
                padding: 22,
                textAlign: "center",
                marginBottom: 20,
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  fontFamily: "Georgia,serif",
                  fontSize: 20,
                  color: "#1a0a00",
                  marginBottom: 6,
                }}
              >
                Войдите для заказа
              </div>
              <div style={{ color: "#8a6a50", fontSize: 12, marginBottom: 14 }}>
                Отслеживайте статус заказа в аккаунте
              </div>
              <button
                onClick={onLogin}
                style={{
                  background: "#cc0000",
                  color: "#fff",
                  border: "none",
                  padding: "12px 24px",
                  fontFamily: "inherit",
                  fontSize: 11,
                  letterSpacing: 2,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  borderRadius: 2,
                  width: "100%",
                }}
              >
                Войти →
              </button>
            </div>
          )}

          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 28,
              fontWeight: 700,
              color: "#1a0a00",
              marginBottom: 22,
            }}
          >
            Оформление
          </div>

          {[
            ["name", "Имя", "Ваше имя"],
            ["phone", "Телефон", "+7 999 000-00-00"],
            ["address", "Адрес доставки", "Улица, дом, квартира"],
            ["comment", "Комментарий", "Без лука..."],
          ].map(([k, l, p]) => (
            <div
              key={k}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 14,
              }}
            >
              <label style={authLabelStyle}>{l}</label>
              <input
                value={form[k]}
                onChange={f(k)}
                placeholder={p}
                style={authInputStyle}
              />
            </div>
          ))}

          {/* Способ оплаты */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 14,
            }}
          >
            <label style={authLabelStyle}>Способ оплаты</label>
            <select
              value={form.payment}
              onChange={f("payment")}
              style={authInputStyle}
            >
              {paymentService
                .getOptions()
                .map(({ key, label, description }) => (
                  <option key={key} value={key}>
                    {label}
                    {description ? ` — ${description}` : ""}
                  </option>
                ))}
            </select>
          </div>

          {/* Подсказки для разных методов оплаты */}
          {form.payment === "kaspi" && (
            <div
              style={{
                background: "#fff8f0",
                border: "1px solid #ffd090",
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 11,
                color: "#995500",
                marginBottom: 14,
                display: "flex",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>💳</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  Kaspi Pay
                </div>
                <div>
                  Откроется QR-код для перевода на {KASPI_PHONE}. Подтвердите —
                  заказ сохранится.
                </div>
              </div>
            </div>
          )}
          {form.payment === "stripe" && (
            <div
              style={{
                background: "#f0f4ff",
                border: "1px solid #c0d0ff",
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 11,
                color: "#224499",
                marginBottom: 14,
                display: "flex",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>🌐</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  Оплата онлайн
                </div>
                <div>
                  Заказ сохранится, затем вы будете перенаправлены на защищённую
                  страницу Stripe.
                </div>
              </div>
            </div>
          )}

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #e8ddd0",
              margin: "18px 0",
            }}
          />

          {cart.map((i, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "#8a6a50",
                marginBottom: 6,
              }}
            >
              <span>
                {i.name} × {i.qty}
              </span>
              <span>{tg(i.price * i.qty)}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#8a6a50",
              marginBottom: 6,
            }}
          >
            <span>Доставка</span>
            <span style={{ color: deliveryCost === 0 ? "#22aa44" : "inherit" }}>
              {deliveryCost === 0 ? "Бесплатно 🎉" : tg(deliveryCost)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              paddingTop: 14,
              borderTop: "2px solid #cc0000",
            }}
          >
            <div
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 20,
                color: "#1a0a00",
              }}
            >
              Итого
            </div>
            <div
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 32,
                fontWeight: 700,
                color: "#cc0000",
              }}
            >
              {tg(total)}
            </div>
          </div>
          <button
            onClick={placeOrder}
            disabled={submitting}
            style={{
              background: submitting ? "#e0a0a0" : "#cc0000",
              color: "#fff",
              border: "none",
              padding: 15,
              fontFamily: "inherit",
              fontSize: 11,
              letterSpacing: 3,
              cursor: submitting ? "default" : "pointer",
              textTransform: "uppercase",
              fontWeight: 700,
              borderRadius: 2,
              width: "100%",
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {submitting
              ? "Оформляем..."
              : user
              ? "Оформить заказ →"
              : "Войдите для заказа"}
          </button>
        </div>
      </div>

      {showKaspi && (
        <KaspiModal
          amount={total}
          onConfirm={async () => {
            setShowKaspi(false);
            const orderId = await submitOrder();
            if (orderId) {
              toast("Заказ принят! Готовим для вас 🍷");
              setCart([]);
              setTimeout(onOrderDone, 1400);
            }
          }}
          onClose={() => setShowKaspi(false)}
        />
      )}

      {showRedirectModal && (
        <PaymentRedirectModal
          loading={!redirectError}
          error={redirectError}
          onClose={() => {
            setShowRedirectModal(false);
            setRedirectError("");
          }}
        />
      )}
    </div>
  );
}

function OrdersPage({ user }) {
  const { data, loading } = useFirebaseValue(
    user ? `users/${user.uid}/orders` : null
  );
  const [open, setOpen] = useState(null);

  const orders: OrderItem[] = data
    ? Object.entries(data as Record<string, any>)
        .map(([id, o]) => ({ orderId: id, ...(o as Record<string, any>) } as OrderItem))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    : [];

  const sTxt = {
    new: "Принят",
    cooking: "Готовим 🍳",
    delivering: "В пути 🛵",
    done: "Доставлен ✓",
    cancelled: "Отменён",
  };
  const pillColors = {
    new: { bg: "#fff3cd", color: "#856404", border: "#ffc107" },
    cooking: { bg: "#fff0e6", color: "#cc5500", border: "#ff8c00" },
    delivering: { bg: "#e6f0ff", color: "#0055cc", border: "#4488ff" },
    done: { bg: "#e6ffe6", color: "#006600", border: "#44bb44" },
    cancelled: { bg: "#ffe6e6", color: "#cc0000", border: "#ff4444" },
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "60px 40px" }}>
      <div
        style={{
          marginBottom: 40,
          paddingBottom: 24,
          borderBottom: "2px solid #cc0000",
        }}
      >
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 52,
            fontWeight: 700,
            color: "#1a0a00",
          }}
        >
          Мои <span style={{ color: "#cc0000" }}>заказы</span>
        </div>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 16,
            fontStyle: "italic",
            color: "#8a6a50",
            marginTop: 4,
          }}
        >
          История и статус заказов
        </div>
      </div>
      {!user ? (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            fontSize: 11,
            color: "#8a6a50",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Войдите, чтобы увидеть заказы
        </div>
      ) : loading ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            fontSize: 11,
            color: "#8a6a50",
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          У вас пока нет заказов
        </div>
      ) : (
        orders.map((o) => {
          const pc = pillColors[o.status] || pillColors.new;
          return (
            <div
              key={o.orderId}
              style={{
                background: "#fff",
                border: "1px solid #e8ddd0",
                marginBottom: 10,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                onClick={() => setOpen(open === o.orderId ? null : o.orderId)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 22px",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "Georgia,serif",
                      fontSize: 14,
                      color: "#cc0000",
                      letterSpacing: 1,
                      fontWeight: 700,
                    }}
                  >
                    Заказ #{o.orderId.slice(-8).toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#8a6a50",
                      marginTop: 2,
                      letterSpacing: 1,
                    }}
                  >
                    {new Date(o.createdAt).toLocaleString("ru")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{
                      fontFamily: "Georgia,serif",
                      fontSize: 18,
                      color: "#1a0a00",
                      fontWeight: 700,
                    }}
                  >
                    {tg(o.total || 0)}
                  </span>
                  {/* Статус заказа */}
                  <span
                    style={{
                      padding: "3px 12px",
                      fontSize: 9,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      fontWeight: 800,
                      borderRadius: 20,
                      background: pc.bg,
                      color: pc.color,
                      border: `1px solid ${pc.border}`,
                    }}
                  >
                    {sTxt[o.status] || o.status}
                  </span>
                  {/* Статус оплаты — показывается отдельно */}
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
              </div>
              {open === o.orderId && (
                <div style={{ padding: "20px 22px", background: "#fafafa" }}>
                  <div
                    style={{ fontSize: 11, color: "#8a6a50", marginBottom: 10 }}
                  >
                    📍 {o.address} · 💳 {o.payments}
                    {o.comment && (
                      <>
                        <br />
                        💬 {o.comment}
                      </>
                    )}
                  </div>
                  {(o.items?.dishes || []).map((d: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        color: "#8a6a50",
                        padding: "6px 0",
                        borderBottom: "1px solid #e8ddd0",
                      }}
                    >
                      <span>
                        {d.name} × {d.qty}
                      </span>
                      <span>{tg(d.subtotal || 0)}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 12,
                      fontFamily: "Georgia,serif",
                      fontSize: 16,
                    }}
                  >
                    <span>Итого</span>
                    <span style={{ color: "#cc0000" }}>{tg(o.total || 0)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mamashvili_cart") || "[]");
    } catch {
      return [];
    }
  });
  const [connected, setConnected] = useState(null);
  const { msg, visible, show: toast } = useToast();

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
      }),
    []
  );
  useEffect(
    () => onValue(ref(db, ".info/connected"), (s) => setConnected(s.val())),
    []
  );
  useEffect(
    () => localStorage.setItem("mamashvili_cart", JSON.stringify(cart)),
    [cart]
  );

  const addToCart = (d) =>
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === d.id);
      if (idx >= 0)
        return prev.map((it, i) =>
          i === idx ? { ...it, qty: it.qty + 1 } : it
        );
      return [...prev, { ...d, qty: 1 }];
    });
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const navBtnStyle = (isActive) => ({
    background: isActive ? "#cc0000" : "none",
    border: `1px solid ${isActive ? "#cc0000" : "transparent"}`,
    color: isActive ? "#fff" : "#8a6a50",
    padding: "7px 16px",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    cursor: "pointer",
    textTransform: "uppercase",
    fontWeight: 500,
    borderRadius: 2,
  });

  if (authLoading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <Spinner />
      </div>
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f4f0",
        fontFamily: "Raleway,sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-16px) scale(.98) } to { opacity:1; transform:translateY(0) scale(1) } }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .mobile-bottom-nav { display: flex !important; }
          .nav-logo-text { font-size: 18px !important; }
          .nav-subtitle { display: none !important; }
          .nav-bar { padding: 0 16px !important; height: 56px !important; }
        }
        @media (min-width: 641px) {
          .mobile-bottom-nav { display: none !important; }
          .desktop-nav { display: flex !important; }
        }
      `}</style>
      <nav
        className="nav-bar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#fff",
          borderBottom: "3px solid #cc0000",
          boxShadow: "0 2px 20px rgba(204,0,0,.08)",
          padding: "0 40px",
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div
          onClick={() => setPage("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            cursor: "pointer",
          }}
        >
          <GeorgianFlag size={40} />
          <div
            style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}
          >
            <div
              className="nav-logo-text"
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 26,
                fontWeight: 700,
                color: "#cc0000",
                letterSpacing: 2,
              }}
            >
              Мамашвили
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: "#8a6a50",
                marginTop: 1,
              }}
              className="nav-subtitle"
            >
              Georgian Kitchen
            </div>
          </div>
        </div>
        <div
          className="desktop-nav"
          style={{ display: "flex", gap: 4, alignItems: "center" }}
        >
          {[
            ["home", "Главная"],
            ["menu", "Меню"],
            ["orders", "Заказы"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={navBtnStyle(page === id)}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setPage("cart")}
            style={{
              background: "#cc0000",
              color: "#fff",
              border: "none",
              padding: "9px 22px",
              fontFamily: "inherit",
              fontSize: 11,
              letterSpacing: 2,
              cursor: "pointer",
              textTransform: "uppercase",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 2,
            }}
          >
            🛒 Корзина{" "}
            <span
              style={{
                background: "#fff",
                color: "#cc0000",
                width: 20,
                height: 20,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              {cartCount}
            </span>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #cc0000",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "#cc0000",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {(user.displayName ||
                      user.phoneNumber ||
                      "G")[0].toUpperCase()}
                  </div>
                )}
                <span
                  style={{
                    fontSize: 11,
                    letterSpacing: 1,
                    color: "#8a6a50",
                    maxWidth: 90,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.displayName || user.phoneNumber || user.email}
                </span>
              </div>
              <button
                onClick={() => {
                  signOut(auth);
                  toast("До свидания! 🇬🇪");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#8a6a50",
                  fontSize: 10,
                  letterSpacing: 1,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  fontFamily: "inherit",
                }}
              >
                Выйти
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              style={{
                background: "none",
                border: "2px solid #cc0000",
                color: "#cc0000",
                padding: "6px 16px",
                fontFamily: "inherit",
                fontSize: 10,
                letterSpacing: 2,
                cursor: "pointer",
                textTransform: "uppercase",
                fontWeight: 700,
                borderRadius: 2,
              }}
            >
              Войти
            </button>
          )}
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: connected ? "#22aa44" : "#ccc",
              boxShadow: connected ? "0 0 6px #22aa44" : "none",
              marginLeft: 4,
            }}
          />
        </div>
      </nav>

      {/* ─── Mobile Bottom Navigation ─── */}
      <div
        className="mobile-bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: "#fff",
          borderTop: "2px solid #cc0000",
          boxShadow: "0 -4px 20px rgba(0,0,0,.08)",
          display: "none",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "8px 0 12px",
        }}
      >
        {[
          ["home", "🏠", "Главная"],
          ["menu", "🍽️", "Меню"],
          ["cart", "🛒", "Корзина"],
          ["orders", "📋", "Заказы"],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{
              background: "none",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              padding: "4px 12px",
              position: "relative",
            }}
          >
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontFamily: "Raleway,sans-serif",
                fontWeight: page === id ? 800 : 500,
                color: page === id ? "#cc0000" : "#8a6a50",
              }}
            >
              {label}
            </span>
            {id === "cart" && cartCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  right: 6,
                  background: "#cc0000",
                  color: "#fff",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  fontSize: 9,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => (user ? signOut(auth) : setShowAuth(true))}
          style={{
            background: "none",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            cursor: "pointer",
            padding: "4px 12px",
          }}
        >
          <span style={{ fontSize: 22 }}>{user ? "👤" : "🔐"}</span>
          <span
            style={{
              fontSize: 9,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontFamily: "Raleway,sans-serif",
              fontWeight: 500,
              color: "#8a6a50",
            }}
          >
            {user ? "Выйти" : "Войти"}
          </span>
        </button>
      </div>

      {/* Padding for mobile bottom nav */}
      <div
        className="mobile-bottom-nav"
        style={{ height: 70, display: "none" }}
      />

      {page === "home" && (
        <HomePage
          onMenu={() => setPage("menu")}
          onLogin={() => setShowAuth(true)}
          user={user}
        />
      )}
      {page === "menu" && (
        <MenuPage
          user={user}
          onAddToCart={addToCart}
          toast={toast}
          onLogin={() => setShowAuth(true)}
        />
      )}
      {page === "cart" && (
        <CartPage
          cart={cart}
          setCart={setCart}
          toast={toast}
          onOrderDone={() => setPage("orders")}
          user={user}
          onLogin={() => setShowAuth(true)}
        />
      )}
      {page === "orders" && <OrdersPage user={user} />}

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} toast={toast} />
      )}

      <div
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
          right: 16,
          zIndex: 9998,
          background: "#cc0000",
          color: "#fff",
          padding: "14px 24px",
          fontSize: 11,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontWeight: 700,
          transform: visible ? "translateY(0)" : "translateY(80px)",
          opacity: visible ? 1 : 0,
          transition: "all .3s",
          pointerEvents: "none",
          borderRadius: 2,
          boxShadow: "0 8px 24px rgba(204,0,0,.3)",
        }}
      >
        {msg}
      </div>
    </div>
  );
}
