/**
 * WalletConnect / Web3Modal Configuration with cross-fetch window.fetch getter polyfill
 * and safe JSON.parse / stale pairing cleanup
 */

function patchFetchPrototype() {
  if (typeof window === 'undefined') return;
  try {
    const origFetch = window.fetch ? window.fetch.bind(window) : undefined;
    if (origFetch) {
      const setter = function (this: any, val: any) {
        try {
          Object.defineProperty(this, 'fetch', {
            value: val,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } catch (_) {
          this._fetch = val;
        }
      };

      try {
        Object.defineProperty(window, 'fetch', {
          get: () => origFetch,
          set: setter,
          configurable: true,
          enumerable: true
        });
      } catch (_) {}

      if (typeof Window !== 'undefined' && Window.prototype) {
        try {
          Object.defineProperty(Window.prototype, 'fetch', {
            get: () => origFetch,
            set: setter,
            configurable: true,
            enumerable: true
          });
        } catch (_) {}
      }
    }

    // Polyfill preventivo para JSON.parse cuando recibe objetos o "[object Object]" desde listeners de postMessage en iframes
    const origJSONParse = JSON.parse;
    (JSON as any).parse = function (text: any, reviver?: any) {
      if (typeof text !== 'string') {
        if (typeof text === 'object' && text !== null) return text;
        try {
          text = String(text);
        } catch (_) {
          return {};
        }
      }
      if (text === '[object Object]') {
        return {};
      }
      return origJSONParse.call(this, text, reviver);
    };

    // Interceptar y silenciar excepciones asíncronas de pairings eliminados de WalletConnect
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reasonStr = event?.reason?.message || event?.reason?.msg || String(event?.reason || '');
      if (reasonStr.includes('Record was recently deleted') || reasonStr.includes('pairing:') || reasonStr.includes('[object Object]')) {
        console.warn('Protección Web3: Excepción asíncrona de sesión previa interceptada:', reasonStr);
        event.preventDefault();
      }
    });

    window.addEventListener('error', (event: ErrorEvent) => {
      const msg = event?.message || '';
      if (msg.includes('Record was recently deleted') || msg.includes('[object Object]')) {
        console.warn('Protección Web3: Error de sincronización interceptado:', msg);
        event.preventDefault();
      }
    });
  } catch (_) {}
}

export function cleanupStaleWalletConnectStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('wc@2:') || key.startsWith('@w3m/'))) {
        try {
          const val = localStorage.getItem(key);
          if (
            val === '[object Object]' ||
            (val && val.includes('6acd59906fcce132d5896b92b8b0d055411f2179f278ab00374974a987fd9503'))
          ) {
            keysToRemove.push(key);
          }
        } catch (_) {}
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (_) {}
    });
  } catch (_) {}
}

export async function setupWalletConnect(projectId: string) {
  patchFetchPrototype();
  cleanupStaleWalletConnectStorage();

  const cleanId = (projectId || '').trim();
  if (!cleanId || cleanId === '3fcc6bba2d1de9622da6d114a8a366cb' || cleanId.length < 16) {
    console.warn("WalletConnect: Project ID no configurado o es el placeholder de prueba.");
    return null;
  }

  try {
    const { createWeb3Modal, defaultConfig } = await import('@web3modal/ethers');

    const bsc = {
      chainId: 56,
      name: 'BNB Smart Chain',
      currency: 'BNB',
      explorerUrl: 'https://bscscan.com',
      rpcUrl: 'https://bsc-dataseed.binance.org/'
    };

    const metadata = {
      name: 'Dólar LATAM ($-LATAM)',
      description: 'Swap oficial de $-LATAM y USDT en BNB Smart Chain',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://swap-latam-v2.vercel.app',
      icons: ['https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png']
    };

    const ethersConfig = defaultConfig({
      metadata,
      defaultChainId: 56,
      enableEIP6963: true,
      enableInjected: false, // Evita conflictos con window.ethereum directo y llamadas dobles a MetaMask
      enableCoinbase: false,
      rpcUrl: 'https://bsc-dataseed.binance.org/'
    });

    return createWeb3Modal({
      ethersConfig,
      chains: [bsc],
      projectId: cleanId,
      enableAnalytics: false,
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#10b981',
        '--w3m-color-mix': '#06b6d4',
        '--w3m-border-radius-master': '16px'
      }
    });
  } catch (err) {
    console.warn("Error al inicializar Web3Modal:", err);
    return null;
  }
}
