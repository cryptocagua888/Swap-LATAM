/**
 * WalletConnect / Web3Modal Configuration with cross-fetch window.fetch getter polyfill
 */

function patchFetchPrototype() {
  if (typeof window === 'undefined') return;
  try {
    const origFetch = window.fetch ? window.fetch.bind(window) : undefined;
    if (!origFetch) return;

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
  } catch (_) {}
}

export async function setupWalletConnect(projectId: string) {
  patchFetchPrototype();

  const cleanId = (projectId || '').trim();
  if (!cleanId || cleanId === '3fcc6bba2d1de9622da6d114a8a366cb' || cleanId.length < 16) {
    console.warn("WalletConnect: Project ID no configurado o es el placeholder de prueba.");
    return null;
  }

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
}
