import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'FormPilot',
    description:
      'Remplissez automatiquement vos formulaires web à partir de profils chiffrés. Détection intelligente des champs, support Weezevent, pièces jointes et panneau latéral.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    icons: {
      16:  'icons/icon-16.png',
      32:  'icons/icon-32.png',
      48:  'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: 'FormPilot',
      default_icon: {
        16:  'icons/icon-16.png',
        32:  'icons/icon-32.png',
        48:  'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
    side_panel: {
      default_path: 'sidepanel/index.html',
    },
    commands: {
      'fill-form': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Détecter et remplir le formulaire de la page',
      },
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
