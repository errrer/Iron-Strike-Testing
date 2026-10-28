// Map Maker / Model Maker launchers: show the "not playable / not usable in game" warning, then lazily load the 3D editor (js/mapmaker3d.js).
export function initMapMaker($, showScreen) {
  const wire = (open, screen, p, opts) => {
    let ed = null;
    $(open).addEventListener('click', () => { $(p + 'Warn').classList.remove('hidden'); $(p + 'Editor').classList.add('hidden'); showScreen(screen); });
    $(p + 'Back').addEventListener('click', () => showScreen('landing'));
    $(p + 'Ok').addEventListener('click', async () => {
      $(p + 'Warn').classList.add('hidden'); $(p + 'Editor').classList.remove('hidden');
      try {
        const m = await import('./mapmaker3d.js?v=0.16.1');
        ed = ed || m.createEditor($(p + 'Editor'), () => showScreen('landing'), opts);
        ed.show();
      } catch (e) { $(p + 'Editor').innerHTML = '<p style="padding:20px">Could not load the 3D editor (' + String(e.message || e) + '). Check your connection and try again.</p>'; console.error(e); }
    });
  };
  wire('lMM', 'mmaker', 'mm', { kind: 'map' });
  wire('lMD', 'mdmaker', 'md', { kind: 'model' });
}
