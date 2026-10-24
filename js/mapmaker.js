// Map Maker launcher: shows the "not playable in game" warning, then lazily loads the 3D editor (js/mapmaker3d.js).
export function initMapMaker($, showScreen) {
  let ed = null;
  $('lMM').addEventListener('click', () => { $('mmWarn').classList.remove('hidden'); $('mmEditor').classList.add('hidden'); showScreen('mmaker'); });
  $('mmBack').addEventListener('click', () => showScreen('landing'));
  $('mmOk').addEventListener('click', async () => {
    $('mmWarn').classList.add('hidden'); $('mmEditor').classList.remove('hidden');
    try {
      const m = await import('./mapmaker3d.js');
      ed = ed || m.createEditor($('mmEditor'), () => showScreen('landing'));
      ed.show();
    } catch (e) { $('mmEditor').innerHTML = '<p style="padding:20px">Could not load the 3D editor (' + String(e.message || e) + '). Check your connection and try again.</p>'; console.error(e); }
  });
}
