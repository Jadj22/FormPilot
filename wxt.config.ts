import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  manifest: {
    name: 'FormPilot',
    description:
      'Remplissez automatiquement vos formulaires web à partir de profils chiffrés. Détection intelligente des champs, support Weezevent, pièces jointes et panneau latéral.',
    version: '1.0.0',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'FormPilot',
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
