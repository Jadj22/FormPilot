export default defineBackground(() => {
  browser.commands?.onCommand?.addListener(async (command) => {
    if (command !== 'fill-form') return;
    try {
      await browser.action.openPopup();
    } catch {
      // openPopup n'est pas supporté partout ; l'utilisateur peut cliquer l'icône.
    }
  });
});
