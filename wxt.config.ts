import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'FormPilot',
    description:
      "Remplissez automatiquement les formulaires web à partir de profils chiffrés, avec aperçu et confirmation.",
    version: '0.1.0',
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
