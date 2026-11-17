// Dedicated, hand-built models for the guns that used to reuse another gun's model. Each one is modelled on its real-life counterpart
// (proportions, furniture, sights, magazine shape) rather than recolouring a base model. `makeReal(kit)` gets the builder helpers from gunmodels.js.
export function makeReal(K) {
  const { B, M, V, mark, ironSights, triggerGroup, mat, cm } = K;
  const C = (hex, m = 0.15, r = 0.65) => cm(mat(hex, m, r)), P = (hex) => mat(hex, 0.1, 0.7);
  const teeth = (b, z0, z1, y, w, step = 0.022) => { for (let z = z0; z > z1; z -= step) b.box(w, 0.004, 0.011, 0, y, z, M.blued()); };
  const R = {};

  R.m16 = () => {                                             // M16A4: flat-top, long round handguard, A2 front sight tower, fixed stock
    const b = new B();
    b.box(0.036, 0.05, 0.22, 0, 0.02, 0.0, M.blued()); teeth(b, 0.1, -0.12, 0.047, 0.02);
    b.box(0.034, 0.052, 0.15, 0, -0.027, 0.03, M.blued());                                           // lower
    b.tube(0.0095, 0.62, 0, 0.012, -0.38, M.steel());                                                // 20" barrel
    b.tube(0.021, 0.36, 0, 0.012, -0.27, M.poly()); for (let i = 0; i < 6; i++) b.tube(0.0225, 0.006, 0, 0.012, -0.12 - i * 0.055, M.black());
    b.box(0.018, 0.07, 0.03, 0, 0.04, -0.5, M.steel()); b.box(0.012, 0.03, 0.02, 0, 0.082, -0.5, M.steel());   // A2 front sight tower
    b.tube(0.014, 0.07, 0, 0.012, -0.66, M.black()); for (let i = 0; i < 3; i++) b.tube(0.0155, 0.004, 0, 0.012, -0.64 - i * 0.015, M.steel());   // birdcage
    ironSights(b, { y: 0.0845, zr: 0.06, zf: -0.5, br: 0.049, bf: 0.075, r: 0.0055 });
    for (let k = 0; k < 2; k++) mark(b.box(0.028, 0.065, 0.045, 0, -0.088 - k * 0.058, 0.0 + k * 0.006, M.steel(), 0.07 * k), 'mag');
    b.box(0.03, 0.09, 0.04, 0, -0.1, 0.105, M.poly(), -0.42); triggerGroup(b, 0, -0.04, 0.045);
    b.box(0.038, 0.075, 0.27, 0, -0.022, 0.31, M.poly(), 0.07); b.box(0.04, 0.095, 0.014, 0, -0.03, 0.455, M.rubber(), 0.07);   // A2 stock
    b.tube(0.017, 0.12, 0, 0.002, 0.18, M.black()); b.box(0.018, 0.01, 0.03, 0, 0.05, 0.1, M.black()); b.box(0.006, 0.02, 0.04, 0.0195, 0.022, 0.03, M.black());
    return b.done({ muzzle: V(0, 0.012, -0.7), sightY: 0.0845, grip: V(0, -0.1, 0.105), fore: V(0, 0.0, -0.27), pistol: false, side: V(0.024, 0.012, -0.3), mount: V(0, 0.049, 0.0), under: V(0, -0.012, -0.27) });
  };

  R.ak74 = () => {                                            // AK-74: plum polymer furniture, big two-chamber brake, side-cut stock
    const b = new B(), plum = C(0x6b2b1c, 0.1, 0.55);
    b.box(0.05, 0.062, 0.32, 0, 0.0, -0.01, M.blued()); b.box(0.046, 0.022, 0.3, 0, 0.04, 0.0, M.blued());
    for (let i = 0; i < 4; i++) b.box(0.048, 0.003, 0.2, 0, 0.0525, -0.1 + i * 0.001, M.blued());
    b.tube(0.0092, 0.36, 0, 0.012, -0.35, M.steel()); b.tube(0.012, 0.2, 0, 0.046, -0.33, M.steel());
    b.box(0.046, 0.03, 0.2, 0, 0.044, -0.33, plum); b.box(0.054, 0.042, 0.2, 0, -0.006, -0.32, plum);
    for (let i = 0; i < 5; i++) { b.box(0.057, 0.004, 0.012, 0, -0.004, -0.25 - i * 0.036, M.black()); }
    b.box(0.02, 0.06, 0.028, 0, 0.03, -0.5, M.steel());
    ironSights(b, { y: 0.068, zr: -0.1, zf: -0.5, br: 0.051, bf: 0.06, open: true });
    b.tube(0.019, 0.07, 0, 0.012, -0.575, M.black()); b.tube(0.0155, 0.04, 0, 0.012, -0.53, M.steel());    // muzzle brake
    for (let i = 0; i < 3; i++) b.box(0.042, 0.004, 0.012, 0, 0.012, -0.552 - i * 0.016, M.steel());
    for (let k = 0; k < 4; k++) mark(b.box(0.034, 0.075, 0.056, 0, -0.07 - k * 0.062, -0.03 - k * 0.003 - k * k * 0.0025, plum, 0.1 + k * 0.07), 'mag');
    for (let k = 0; k < 4; k++) b.box(0.036, 0.003, 0.05, 0, -0.045 - k * 0.062, -0.03 - k * 0.003, M.black(), 0.1 + k * 0.07);
    b.box(0.032, 0.1, 0.045, 0, -0.1, 0.12, plum, -0.32); triggerGroup(b, 0, -0.038, 0.03);
    b.box(0.036, 0.06, 0.012, 0, 0.012, 0.155, plum);
    b.box(0.032, 0.012, 0.22, 0, 0.026, 0.27, plum, 0.05); b.box(0.032, 0.012, 0.2, 0, -0.056, 0.27, plum, 0.0); b.box(0.034, 0.08, 0.016, 0, -0.016, 0.36, plum, 0.04);   // skeleton stock frame
    b.box(0.04, 0.1, 0.012, 0, -0.02, 0.375, M.rubber(), 0.05); b.rod(0.006, 0.03, 0.036, 0.02, 0.005, M.steel());
    return b.done({ muzzle: V(0, 0.012, -0.612), sightY: 0.068, grip: V(0, -0.1, 0.12), fore: V(0, -0.025, -0.31), pistol: false, side: V(0.028, -0.006, -0.37), mount: V(0, 0.054, 0.03), under: V(0, -0.027, -0.31) });
  };

  R.fal = () => {                                             // FAL: tall receiver, carry handle with aperture, vented wood furniture, long slotted hider
    const b = new B(), wood = M.wood();
    b.box(0.042, 0.075, 0.3, 0, 0.012, 0.0, M.blued()); b.box(0.046, 0.02, 0.18, 0, 0.056, 0.02, M.blued());
    b.box(0.03, 0.014, 0.3, 0, 0.074, 0.0, M.steel(), 0); b.box(0.014, 0.03, 0.02, 0, 0.088, 0.14, M.blued());      // carry handle + rear sight
    b.tube(0.0098, 0.52, 0, 0.02, -0.4, M.steel()); b.tube(0.012, 0.3, 0, 0.049, -0.36, M.steel());                 // barrel + gas tube
    b.box(0.048, 0.04, 0.26, 0, 0.0, -0.3, wood); for (let i = 0; i < 4; i++) b.box(0.05, 0.012, 0.03, 0, 0.002, -0.2 - i * 0.05, M.black());   // handguard vents
    b.box(0.018, 0.04, 0.026, 0, 0.044, -0.52, M.blued()); b.tube(0.016, 0.09, 0, 0.02, -0.64, M.black());
    for (const z of [-0.61, -0.635, -0.66]) b.box(0.034, 0.004, 0.008, 0, 0.02, z, M.steel());
    ironSights(b, { y: 0.088, zr: 0.14, zf: -0.52, br: 0.082, bf: 0.062, r: 0.005 });
    mark(b.box(0.03, 0.11, 0.05, 0, -0.095, -0.01, M.steel(), 0.02), 'mag'); b.box(0.028, 0.02, 0.05, 0, -0.04, -0.01, M.steel());
    b.box(0.03, 0.09, 0.04, 0, -0.07, 0.15, M.poly(), -0.35); triggerGroup(b, 0, -0.035, 0.07);
    b.box(0.036, 0.07, 0.3, 0, 0.0, 0.3, wood, 0.0); b.box(0.04, 0.1, 0.012, 0, 0.0, 0.46, M.rubber());
    b.rod(0.006, 0.03, 0.03, 0.02, 0.05, M.steel());
    return b.done({ muzzle: V(0, 0.02, -0.69), sightY: 0.088, grip: V(0, -0.07, 0.15), fore: V(0, -0.01, -0.3), pistol: false, side: V(0.028, 0.0, -0.3), mount: V(0, 0.075, 0.0), under: V(0, -0.022, -0.3) });
  };

  R.g36 = () => {                                             // G36C: grey polymer, big integrated carry-handle optic, clear mag, short barrel, side-folding stock
    const b = new B(), pl = C(0x4a4d52, 0.05, 0.6);
    b.box(0.044, 0.06, 0.3, 0, 0.0, 0.0, pl); b.box(0.04, 0.05, 0.13, 0, 0.06, 0.05, pl); b.box(0.048, 0.03, 0.1, 0, 0.1, 0.05, M.black());     // carry handle with sight housing
    b.tube(0.0075, 0.04, 0, 0.11, -0.01, M.black()); b.tube(0.016, 0.004, 0, 0.1, 0.1, M.lens());                       // reticle tube
    b.box(0.014, 0.014, 0.02, 0, 0.105, 0.115, M.black());
    b.box(0.046, 0.05, 0.16, 0, -0.002, -0.19, pl); for (let i = 0; i < 5; i++) b.box(0.048, 0.012, 0.012, 0, 0.0, -0.14 - i * 0.026, M.black());   // vented handguard
    b.tube(0.0085, 0.2, 0, 0.012, -0.38, M.steel()); b.tube(0.0135, 0.08, 0, 0.012, -0.44, M.black());
    for (const z of [-0.41, -0.43, -0.45]) b.box(0.03, 0.003, 0.01, 0, 0.012, z, M.steel());
    b.box(0.014, 0.04, 0.02, 0, 0.03, -0.3, M.black());
    const clear = P(0x9aa4aa); clear.transparent = true; clear.opacity = 0.55;
    for (let k = 0; k < 3; k++) mark(b.box(0.03, 0.058, 0.05, 0, -0.07 - k * 0.055, 0.0 + k * 0.005, clear, 0.08 * k), 'mag');
    b.box(0.03, 0.09, 0.042, 0, -0.1, 0.1, pl, -0.38); triggerGroup(b, 0, -0.035, 0.04);
    b.box(0.03, 0.02, 0.22, 0.0, 0.028, 0.24, pl); b.box(0.03, 0.02, 0.2, 0, -0.05, 0.24, pl); b.box(0.028, 0.08, 0.016, 0, -0.01, 0.34, pl); b.box(0.034, 0.1, 0.012, 0, -0.01, 0.35, M.rubber());   // skeleton stock
    b.box(0.028, 0.02, 0.04, 0.0, 0.0, 0.16, pl);
    return b.done({ muzzle: V(0, 0.012, -0.485), sightY: 0.104, grip: V(0, -0.1, 0.1), fore: V(0, -0.002, -0.19), pistol: false, side: V(0.026, 0.0, -0.2), mount: V(0, 0.115, 0.05), under: V(0, -0.027, -0.19) });
  };

  R.aug = () => {                                             // Steyr AUG: bullpup, mag behind the grip, integrated 1.5x optic, vertical foregrip
    const b = new B(), pl = C(0x3f4a38, 0.05, 0.6);
    b.box(0.05, 0.07, 0.46, 0, 0.0, 0.08, pl); b.box(0.046, 0.05, 0.26, 0, -0.01, -0.2, pl, 0);                      // main housing + short forend
    b.box(0.044, 0.03, 0.2, 0, 0.055, 0.04, M.black()); b.tube(0.017, 0.2, 0, 0.085, 0.04, M.black()); b.tube(0.021, 0.02, 0, 0.085, -0.07, M.black(), 0.017); b.tube(0.0175, 0.004, 0, 0.085, 0.14, M.lens());   // optic + handle
    b.box(0.016, 0.026, 0.1, 0, 0.1, 0.04, M.black());
    b.tube(0.0095, 0.3, 0, 0.012, -0.5, M.steel()); b.tube(0.015, 0.06, 0, 0.012, -0.62, M.black());               // barrel + hider
    b.tube(0.011, 0.12, 0, 0.03, -0.38, M.steel());
    b.box(0.03, 0.09, 0.035, 0, -0.07, -0.2, M.black(), 0.0); b.box(0.02, 0.02, 0.04, 0, -0.03, -0.2, M.black());                                                      // vertical foregrip
    b.box(0.032, 0.1, 0.042, 0, -0.075, -0.02, pl, -0.3); triggerGroup(b, 0, -0.04, -0.06);                         // grip + trigger
    for (let k = 0; k < 2; k++) mark(b.box(0.03, 0.068, 0.048, 0, -0.09 - k * 0.058, 0.14 + k * 0.004, P(0x8a9096), 0.06 * k), 'mag');   // mag behind
    b.box(0.054, 0.1, 0.016, 0, -0.01, 0.325, M.rubber()); b.box(0.03, 0.01, 0.04, 0.0, 0.0, 0.1, M.black());
    b.rod(0.006, 0.03, 0.028, 0.02, 0.0, M.steel());
    return b.done({ muzzle: V(0, 0.012, -0.655), sightY: 0.085, grip: V(0, -0.075, -0.02), fore: V(0, -0.09, -0.2), pistol: false, side: V(0.028, 0.0, -0.26), mount: V(0, 0.07, 0.04), under: V(0, -0.03, -0.26) });
  };

  R.famas = () => {                                           // FAMAS F1: bullpup with the long carry-handle arch, short forend, curved mag behind grip
    const b = new B(), pl = C(0x586046, 0.05, 0.6);
    b.box(0.048, 0.07, 0.46, 0, -0.004, 0.06, pl); b.box(0.044, 0.05, 0.12, 0, -0.012, -0.28, pl);
    b.box(0.016, 0.014, 0.5, 0, 0.066, 0.0, pl); for (const z of [-0.24, 0.24]) b.box(0.016, 0.04, 0.02, 0, 0.046, z, pl);   // carry handle arch
    b.box(0.02, 0.026, 0.02, 0, 0.08, 0.2, M.black()); b.box(0.01, 0.024, 0.016, 0, 0.08, -0.24, M.black());
    b.tube(0.0095, 0.26, 0, 0.012, -0.44, M.steel()); b.tube(0.014, 0.05, 0, 0.012, -0.58, M.black());
    b.box(0.03, 0.034, 0.02, 0, 0.0, -0.22, M.black());
    b.box(0.03, 0.1, 0.04, 0, -0.075, -0.06, pl, -0.3); triggerGroup(b, 0, -0.04, -0.09);
    for (let k = 0; k < 3; k++) mark(b.box(0.03, 0.058, 0.048, 0, -0.085 - k * 0.052, 0.13 + k * 0.012, P(0x303338), 0.14 * k), 'mag');
    b.box(0.052, 0.1, 0.016, 0, -0.008, 0.295, M.rubber(), 0.0); b.box(0.01, 0.03, 0.01, 0.0, 0.006, 0.31, M.black());
    ironSights(b, { y: 0.0885, zr: 0.2, zf: -0.24, br: 0.074, bf: 0.074, r: 0.005 });
    return b.done({ muzzle: V(0, 0.012, -0.605), sightY: 0.0885, grip: V(0, -0.075, -0.06), fore: V(0, -0.012, -0.28), pistol: false, side: V(0.026, -0.004, -0.28), mount: V(0, 0.068, 0.02), under: V(0, -0.04, -0.28) });
  };

  R.hk417 = () => {                                           // HK417: heavy free-float quad-rail forend, big flash hider, straight 20-rd mag, telescoping stock
    const b = new B();
    b.box(0.042, 0.062, 0.26, 0, 0.012, 0.0, M.blued()); teeth(b, 0.1, -0.14, 0.047, 0.02); b.box(0.044, 0.05, 0.14, 0, -0.03, 0.03, M.blued());
    b.box(0.046, 0.046, 0.34, 0, 0.012, -0.3, M.black()); teeth(b, -0.14, -0.46, 0.039, 0.024); for (let i = 0; i < 5; i++) for (const s of [-1, 1]) b.box(0.004, 0.012, 0.03, s * 0.024, 0.012, -0.18 - i * 0.065, M.steel());   // M-LOK slots
    b.box(0.03, 0.01, 0.34, 0, -0.016, -0.3, M.black());
    b.tube(0.0098, 0.2, 0, 0.012, -0.55, M.steel()); b.tube(0.0135, 0.07, 0, 0.012, -0.64, M.black()); for (let i = 0; i < 3; i++) b.box(0.032, 0.004, 0.008, 0, 0.012, -0.62 - i * 0.02, M.steel());
    ironSights(b, { y: 0.079, zr: 0.06, zf: -0.42, br: 0.05, bf: 0.05, r: 0.0055 });
    mark(b.box(0.03, 0.12, 0.05, 0, -0.1, 0.0, M.steel(), 0.0), 'mag'); b.box(0.034, 0.09, 0.042, 0, -0.1, 0.115, M.poly(), -0.4); triggerGroup(b, 0, -0.04, 0.05);
    b.box(0.036, 0.06, 0.2, 0, 0.0, 0.3, M.poly(), 0.02); b.tube(0.014, 0.16, 0, 0.012, 0.2, M.black()); b.box(0.038, 0.09, 0.014, 0, -0.01, 0.405, M.rubber());
    b.box(0.018, 0.01, 0.035, 0, 0.058, 0.08, M.black());
    return b.done({ muzzle: V(0, 0.012, -0.68), sightY: 0.079, grip: V(0, -0.1, 0.115), fore: V(0, 0.0, -0.3), pistol: false, side: V(0.026, 0.012, -0.3), mount: V(0, 0.05, 0.0), under: V(0, -0.012, -0.3) });
  };

  R.ump = () => {                                             // UMP45: boxy polymer body, full-length top rail, ribbed forend, folding wire stock, long straight mag
    const b = new B(), pl = C(0x2d3034, 0.05, 0.6);
    b.box(0.042, 0.06, 0.32, 0, 0.0, 0.02, pl); teeth(b, 0.14, -0.14, 0.033, 0.02, 0.02);
    b.box(0.044, 0.05, 0.14, 0, -0.004, -0.2, pl); for (let i = 0; i < 5; i++) b.box(0.046, 0.04, 0.006, 0, -0.004, -0.15 - i * 0.026, M.black());
    b.tube(0.0095, 0.12, 0, 0.01, -0.33, M.steel()); b.tube(0.014, 0.06, 0, 0.01, -0.34, M.black());
    ironSights(b, { y: 0.058, zr: 0.1, zf: -0.26, br: 0.036, bf: 0.03, r: 0.005 });
    mark(b.box(0.03, 0.15, 0.04, 0, -0.1, 0.0, M.black(), 0.02), 'mag'); b.box(0.034, 0.1, 0.04, 0, -0.065, 0.11, pl, -0.3); triggerGroup(b, 0, -0.035, 0.05);
    b.box(0.014, 0.02, 0.06, 0, 0.02, 0.2, M.black()); b.box(0.01, 0.02, 0.1, 0.0, 0.0, 0.25, M.steel(), 0); b.box(0.028, 0.012, 0.2, 0, 0.012, 0.3, M.steel()); b.box(0.034, 0.07, 0.012, 0, -0.01, 0.4, M.rubber());   // folding stock
    return b.done({ muzzle: V(0, 0.01, -0.375), sightY: 0.058, grip: V(0, -0.065, 0.11), fore: V(0, -0.004, -0.2), pistol: false, side: V(0.024, 0.0, -0.2), mount: V(0, 0.036, 0.0), under: V(0, -0.03, -0.2) });
  };

  R.mp7 = () => {                                             // HK MP7: very compact, mag inside the grip, folded vertical grip, retracted wire stock, short barrel
    const b = new B(), pl = C(0x1f2124, 0.05, 0.55);
    b.box(0.034, 0.06, 0.24, 0, 0.0, 0.0, pl); teeth(b, 0.1, -0.1, 0.033, 0.018, 0.02);
    b.box(0.036, 0.046, 0.1, 0, -0.004, -0.15, pl); b.tube(0.007, 0.09, 0, 0.01, -0.24, M.steel()); b.tube(0.0095, 0.04, 0, 0.01, -0.29, M.black());
    b.box(0.02, 0.04, 0.03, 0, -0.04, -0.16, M.black());                                             // folded foregrip
    mark(b.box(0.027, 0.07, 0.036, 0, -0.1, 0.07, M.black(), -0.18), 'mag'); mark(b.box(0.027, 0.07, 0.034, 0, -0.17, 0.088, M.black(), -0.18), 'mag');
    b.box(0.03, 0.12, 0.04, 0, -0.07, 0.08, pl, -0.18); triggerGroup(b, 0, -0.035, 0.035);
    for (const sd of [-1, 1]) b.box(0.004, 0.004, 0.18, sd * 0.014, 0.01, 0.2, M.steel()); b.box(0.034, 0.05, 0.012, 0, 0.01, 0.29, M.rubber());   // wire stock
    ironSights(b, { y: 0.052, zr: 0.08, zf: -0.13, br: 0.033, bf: 0.033, open: true });
    return b.done({ muzzle: V(0, 0.01, -0.31), sightY: 0.052, grip: V(0, -0.075, 0.08), fore: V(0, -0.02, -0.15), pistol: false, side: V(0.022, 0.0, -0.15), mount: V(0, 0.035, 0.0), under: V(0, -0.025, -0.15) });
  };

  R.pp19 = () => {                                            // PP-19 Bizon: slim AK-style receiver, big helical drum under the barrel, folding stock
    const b = new B(), wd = M.woodDark();
    b.box(0.044, 0.056, 0.3, 0, 0.0, 0.0, M.blued()); b.box(0.04, 0.02, 0.28, 0, 0.036, 0.0, M.blued());
    b.tube(0.009, 0.3, 0, 0.01, -0.3, M.steel()); b.box(0.046, 0.05, 0.2, 0, -0.01, -0.2, wd); b.box(0.04, 0.02, 0.2, 0, 0.032, -0.2, wd);
    b.tube(0.011, 0.12, 0, 0.01, -0.46, M.black());
    mark(b.tube(0.027, 0.3, 0, -0.065, -0.2, M.steel()), 'mag'); for (let i = 0; i < 6; i++) b.tube(0.0285, 0.006, 0, -0.065, -0.07 - i * 0.045, M.black());   // helical drum
    ironSights(b, { y: 0.064, zr: -0.06, zf: -0.4, br: 0.046, bf: 0.03, open: true });
    b.box(0.03, 0.09, 0.04, 0, -0.07, 0.11, wd, -0.3); triggerGroup(b, 0, -0.03, 0.03);
    b.box(0.016, 0.04, 0.12, 0.03, 0.0, 0.2, M.steel()); b.box(0.01, 0.06, 0.2, 0.034, 0.0, 0.26, M.steel()); b.box(0.014, 0.07, 0.012, 0.034, -0.01, 0.36, M.rubber());    // side-folded stock
    b.rod(0.006, 0.03, 0.03, 0.02, 0.005, M.steel());
    return b.done({ muzzle: V(0, 0.01, -0.52), sightY: 0.064, grip: V(0, -0.07, 0.11), fore: V(0, -0.02, -0.18), pistol: false, side: V(0.028, 0.0, -0.3), mount: V(0, 0.046, 0.0), under: V(0, -0.095, -0.2) });
  };

  R.kriss = () => {                                           // Kriss Vector: monolithic angled block, mag well in the long grip, vented barrel shroud, rail-mounted skeleton stock
    const b = new B(), pl = C(0x242629, 0.05, 0.55);
    b.box(0.046, 0.07, 0.26, 0, 0.0, 0.03, pl); b.box(0.046, 0.04, 0.12, 0, 0.02, 0.18, pl, 0.35);                    // body + stepped sloping rear
    b.box(0.044, 0.056, 0.2, 0, 0.0, -0.18, pl); for (let i = 0; i < 5; i++) b.box(0.046, 0.012, 0.022, 0, 0.0, -0.1 - i * 0.034, M.black());    // vented shroud
    b.tube(0.012, 0.06, 0, 0.006, -0.31, M.black()); teeth(b, 0.08, -0.2, 0.038, 0.02);
    ironSights(b, { y: 0.062, zr: 0.0, zf: -0.22, br: 0.04, bf: 0.036, open: true });
    b.box(0.034, 0.12, 0.05, 0, -0.1, -0.03, pl, 0.3);                                                              // grip / magwell
    mark(b.box(0.028, 0.1, 0.04, 0, -0.17, -0.06, M.black(), 0.3), 'mag'); mark(b.box(0.028, 0.06, 0.04, 0, -0.2, -0.075, M.black(), 0.3), 'mag');
    b.box(0.03, 0.08, 0.04, 0, -0.06, -0.16, pl, 0); triggerGroup(b, 0, -0.04, -0.1, 0.05);
    b.box(0.014, 0.02, 0.26, 0, 0.0, 0.3, M.steel()); b.box(0.034, 0.08, 0.012, 0, -0.03, 0.42, M.rubber(), 0.2); b.box(0.012, 0.1, 0.012, 0, -0.01, 0.4, M.steel());   // stock
    return b.done({ muzzle: V(0, 0.006, -0.34), sightY: 0.062, grip: V(0, -0.09, -0.03), fore: V(0, -0.02, -0.2), pistol: false, side: V(0.026, 0.0, -0.2), mount: V(0, 0.04, 0.0), under: V(0, -0.03, -0.2) });
  };

  R.mac10 = () => {                                           // MAC-10: cube-like receiver, mag in the grip, wire stock, threaded barrel with a long suppressor
    const b = new B();
    b.box(0.046, 0.058, 0.16, 0, 0.0, 0.0, M.blued()); b.box(0.034, 0.012, 0.1, 0, 0.034, 0.0, M.blued()); b.box(0.04, 0.03, 0.05, 0, 0.0, -0.1, M.blued());
    b.tube(0.014, 0.2, 0, 0.01, -0.2, M.black()); b.tube(0.016, 0.01, 0, 0.01, -0.1, M.steel());                                    // suppressor
    mark(b.box(0.03, 0.12, 0.04, 0, -0.085, 0.04, M.steel(), 0.0), 'mag'); b.box(0.034, 0.05, 0.05, 0, -0.04, 0.04, M.blued());
    b.box(0.014, 0.014, 0.02, 0.0, 0.044, 0.04, M.steel()); b.rod(0.007, 0.02, 0.026, 0.04, -0.01, M.steel());
    for (const sd of [-1, 1]) b.box(0.004, 0.004, 0.16, sd * 0.012, 0.0, 0.16, M.steel()); b.box(0.034, 0.05, 0.01, 0, 0.0, 0.24, M.steel());   // wire stock
    triggerGroup(b, 0, -0.01, 0.075, 0.04);
    ironSights(b, { y: 0.0545, zr: 0.04, zf: -0.1, br: 0.04, bf: 0.045, open: true, pistol: true });
    return b.done({ muzzle: V(0, 0.01, -0.3), sightY: 0.0545, grip: V(0, -0.075, 0.04), fore: V(-0.014, -0.075, 0.03), pistol: true, mount: V(0, 0.04, 0.0), under: V(0, -0.03, -0.06) });
  };

  const bipod = (b, z, y, len = 0.1) => { for (const sd of [-1, 1]) b.box(0.006, len, 0.006, sd * 0.03, y - len / 2, z, M.steel(), 0, 0, sd * 0.25); };
  R.rpk = () => {                                             // RPK: heavy AK receiver, long barrel with bipod, wood furniture, 40-round curved mag, humped stock
    const b = new B();
    b.box(0.05, 0.062, 0.32, 0, 0.0, -0.01, M.blued()); b.box(0.046, 0.022, 0.3, 0, 0.04, 0.0, M.blued());
    b.tube(0.0105, 0.58, 0, 0.012, -0.48, M.steel()); b.tube(0.013, 0.26, 0, 0.046, -0.38, M.steel()); b.box(0.05, 0.034, 0.24, 0, 0.044, -0.35, M.wood()); b.box(0.052, 0.04, 0.24, 0, -0.008, -0.34, M.wood());
    b.box(0.02, 0.06, 0.028, 0, 0.03, -0.62, M.steel()); b.tube(0.0135, 0.05, 0, 0.012, -0.77, M.steel());
    bipod(b, -0.6, 0.0, 0.11);
    ironSights(b, { y: 0.068, zr: -0.1, zf: -0.62, br: 0.051, bf: 0.06, open: true });
    for (let k = 0; k < 5; k++) mark(b.box(0.036, 0.08, 0.06, 0, -0.07 - k * 0.062, -0.03 - k * 0.004 - k * k * 0.003, M.steel(), 0.12 + k * 0.08), 'mag');
    b.box(0.032, 0.1, 0.045, 0, -0.1, 0.12, M.woodDark(), -0.32); triggerGroup(b, 0, -0.038, 0.03);
    b.box(0.038, 0.09, 0.22, 0, -0.02, 0.26, M.wood(), 0.03); b.box(0.036, 0.05, 0.1, 0, 0.0, 0.16, M.wood()); b.box(0.04, 0.11, 0.012, 0, -0.02, 0.375, M.steel(), 0.04); b.rod(0.006, 0.03, 0.036, 0.02, 0.005, M.steel());
    return b.done({ muzzle: V(0, 0.012, -0.8), sightY: 0.068, grip: V(0, -0.1, 0.12), fore: V(0, -0.025, -0.34), pistol: false, side: V(0.028, -0.006, -0.5), mount: V(0, 0.054, 0.03), under: V(0, -0.027, -0.34) });
  };

  R.m60 = () => {                                             // M60: top cover with carry handle, perforated shroud, belt box hanging from the left, bipod, pistol grip + hollow stock
    const b = new B(), bk = M.black();
    b.box(0.056, 0.08, 0.34, 0, 0.0, 0.0, M.blued()); b.box(0.05, 0.02, 0.3, 0, 0.05, 0.0, M.steel()); b.box(0.01, 0.03, 0.22, 0, 0.076, 0.0, bk); b.box(0.012, 0.012, 0.04, 0, 0.09, -0.08, bk); // body + top cover + handle
    b.box(0.042, 0.048, 0.34, 0, 0.012, -0.36, M.blued()); for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) b.box(0.003, 0.012, 0.012, sd * 0.022, 0.012, -0.24 - i * 0.04, bk);   // perforated shroud
    b.tube(0.0108, 0.28, 0, 0.012, -0.64, M.steel()); b.tube(0.013, 0.06, 0, 0.012, -0.76, bk); b.tube(0.0125, 0.3, 0, -0.026, -0.36, M.steel());   // barrel, hider, gas tube
    bipod(b, -0.55, -0.01, 0.12); b.box(0.014, 0.034, 0.02, 0, 0.044, -0.74, M.steel());
    ironSights(b, { y: 0.092, zr: 0.1, zf: -0.74, br: 0.07, bf: 0.062, open: true });
    b.box(0.07, 0.07, 0.1, -0.06, -0.04, 0.02, M.steel(), 0, 0, 0); b.box(0.05, 0.03, 0.14, -0.03, -0.01, 0.0, M.steel());    // ammo box + feed tray
    mark(b.box(0.058, 0.074, 0.11, -0.065, -0.045, 0.02, M.steel()), 'mag'); mark(b.box(0.012, 0.01, 0.1, -0.03, 0.005, 0.0, M.brass()), 'mag');
    b.box(0.032, 0.1, 0.044, 0, -0.1, 0.1, M.poly(), -0.3); triggerGroup(b, 0, -0.045, 0.06, 0.06);
    b.box(0.048, 0.09, 0.26, 0, -0.01, 0.3, M.poly(), 0.0); b.box(0.04, 0.12, 0.014, 0, -0.02, 0.44, M.rubber()); b.box(0.04, 0.03, 0.12, 0, 0.0, 0.2, M.poly());
    return b.done({ muzzle: V(0, 0.012, -0.79), sightY: 0.092, grip: V(0, -0.1, 0.1), fore: V(0, -0.01, -0.35), pistol: false, side: V(0.03, 0.012, -0.4), mount: V(0, 0.06, 0.0), under: V(0, -0.03, -0.35) });
  };

  R.pkm = () => {                                             // PKM: boxy stamped receiver, ammo box on the left, fluted long barrel, bipod mid-barrel, wood stock with big thumbhole hole
    const b = new B();
    b.box(0.052, 0.07, 0.38, 0, 0.0, 0.0, M.blued()); b.box(0.046, 0.022, 0.34, 0, 0.046, 0.0, M.blued()); b.box(0.05, 0.016, 0.1, 0, 0.062, 0.1, M.steel());
    for (let i = 0; i < 6; i++) b.box(0.054, 0.003, 0.014, 0, 0.058, -0.12 + i * 0.04, M.black());                           // stamped ribs
    b.tube(0.012, 0.6, 0, 0.014, -0.48, M.steel()); for (let i = 0; i < 6; i++) b.tube(0.0145, 0.04, 0, 0.014, -0.28 - i * 0.07, M.steel());   // fluted barrel
    b.tube(0.0135, 0.2, 0, 0.05, -0.32, M.steel()); b.tube(0.0155, 0.06, 0, 0.014, -0.79, M.black());                          // gas tube + hider
    bipod(b, -0.5, -0.012, 0.1); b.box(0.016, 0.034, 0.02, 0, 0.04, -0.77, M.steel());
    ironSights(b, { y: 0.092, zr: 0.06, zf: -0.77, br: 0.07, bf: 0.058, open: true });
    mark(b.box(0.07, 0.08, 0.13, -0.07, -0.05, 0.0, M.steel()), 'mag'); mark(b.box(0.05, 0.014, 0.11, -0.04, -0.005, 0.0, M.steel()), 'mag');   // belt box
    b.box(0.034, 0.1, 0.044, 0, -0.1, 0.13, M.woodDark(), -0.3); triggerGroup(b, 0, -0.045, 0.07, 0.06);
    b.box(0.04, 0.03, 0.22, 0, 0.012, 0.3, M.wood(), 0.0); b.box(0.04, 0.03, 0.18, 0, -0.1, 0.29, M.wood(), 0.1); b.box(0.04, 0.12, 0.016, 0, -0.04, 0.4, M.wood()); b.box(0.04, 0.12, 0.014, 0, -0.04, 0.42, M.rubber());
    b.box(0.038, 0.07, 0.04, 0, -0.04, 0.2, M.wood(), 0.0);
    return b.done({ muzzle: V(0, 0.014, -0.82), sightY: 0.092, grip: V(0, -0.1, 0.13), fore: V(0, 0.0, -0.3), pistol: false, side: V(0.03, 0.014, -0.4), mount: V(0, 0.07, 0.0), under: V(0, -0.025, -0.3) });
  };

  const scope = (b, z, y, len, r, obj) => {                  // rifle scope with mounts, objective bell, eyepiece and turrets
    for (const dz of [-len * 0.3, len * 0.3]) b.box(0.016, 0.03, 0.018, 0, y - 0.024, z + dz, M.blued());
    b.tube(r, len, 0, y, z, M.black()); b.tube(obj, len * 0.22, 0, y, z - len * 0.5 - 0.005, M.black(), r); b.tube(r * 1.2, len * 0.18, 0, y, z + len * 0.5, M.black(), r);
    b.tube(obj * 0.9, 0.004, 0, y, z - len * 0.5 - len * 0.11 - 0.006, M.lens()); b.tube(r * 1.1, 0.004, 0, y, z + len * 0.59, M.lens());
    b.post(0.008, 0.016, 0, y + r + 0.006, z, M.steel()); b.rod(0.008, 0.016, r + 0.006, y, z, M.steel());
  };
  const boltK = (b, x, y, z) => { mark(b.rod(0.0045, 0.07, x, y, z, M.steel()), 'bolt'); mark(b.ball(0.011, x + 0.04, y, z, M.steel()), 'bolt'); };

  R.r700 = () => {                                            // Remington 700: walnut hunting stock, slim barrel, big-objective scope, blind box magazine
    const b = new B();
    b.box(0.036, 0.048, 0.22, 0, 0.012, 0.0, M.steel()); b.tube(0.0098, 0.62, 0, 0.016, -0.4, M.steel()); b.tube(0.0125, 0.04, 0, 0.016, -0.7, M.steel(), 0.0098);
    b.box(0.038, 0.048, 0.4, 0, -0.012, -0.22, M.wood()); b.box(0.036, 0.034, 0.3, 0, -0.04, 0.25, M.wood(), -0.08);                  // fore-end + stock
    b.box(0.036, 0.08, 0.1, 0, -0.016, 0.1, M.wood()); b.box(0.038, 0.09, 0.014, 0, -0.07, 0.4, M.rubber(), -0.18); b.box(0.034, 0.03, 0.12, 0, -0.04, 0.32, M.wood());
    b.box(0.032, 0.014, 0.08, 0, -0.048, -0.04, M.steel()); triggerGroup(b, 0, -0.04, 0.02, 0.06); boltK(b, 0.04, 0.026, 0.08);
    scope(b, -0.01, 0.07, 0.3, 0.0155, 0.022);
    return b.done({ muzzle: V(0, 0.016, -0.72), sightY: 0.07, grip: V(0, -0.04, 0.09), fore: V(0, -0.01, -0.22), pistol: false, side: V(0.022, 0.0, -0.3), under: V(0, -0.036, -0.22) });
  };

  R.awp = () => {                                             // Arctic Warfare: green chassis stock with thumbhole cut, fluted heavy barrel, slotted brake, scope on a long rail
    const b = new B(), gr = C(0x3e4f3b, 0.05, 0.6);
    b.box(0.04, 0.056, 0.26, 0, 0.012, 0.0, gr); b.tube(0.0115, 0.7, 0, 0.016, -0.46, M.steel()); for (let i = 0; i < 5; i++) b.tube(0.0135, 0.05, 0, 0.016, -0.3 - i * 0.1, M.steel());
    b.tube(0.017, 0.07, 0, 0.016, -0.83, M.black()); for (let i = 0; i < 3; i++) b.box(0.038, 0.004, 0.008, 0, 0.016, -0.8 - i * 0.02, M.steel());
    b.box(0.044, 0.06, 0.46, 0, -0.012, -0.24, gr); b.box(0.036, 0.1, 0.14, 0, -0.03, 0.12, gr); b.box(0.034, 0.012, 0.28, 0, 0.0, 0.3, gr, 0.0); b.box(0.034, 0.012, 0.28, 0, -0.115, 0.31, gr, -0.02);   // thumbhole stock
    b.box(0.034, 0.1, 0.012, 0, -0.06, 0.45, M.rubber()); b.box(0.034, 0.14, 0.016, 0, -0.06, 0.2, gr); b.box(0.03, 0.03, 0.08, 0, -0.06, 0.07, gr);
    mark(b.box(0.028, 0.06, 0.05, 0, -0.07, -0.02, M.black()), 'mag'); triggerGroup(b, 0, -0.04, 0.03, 0.06); boltK(b, 0.04, 0.03, 0.08);
    b.box(0.018, 0.008, 0.3, 0, 0.042, -0.01, M.blued()); scope(b, -0.01, 0.076, 0.34, 0.0165, 0.024);
    bipod(b, -0.4, -0.04, 0.09);
    return b.done({ muzzle: V(0, 0.016, -0.86), sightY: 0.076, grip: V(0, -0.05, 0.09), fore: V(0, -0.02, -0.3), pistol: false, side: V(0.024, 0.0, -0.4), under: V(0, -0.045, -0.3) });
  };

  R.barrett = () => {                                         // M82: giant receiver, big double-baffle brake, fluted barrel, long top rail + scope, front bipod, carry handle
    const b = new B(), bk = M.blued();
    b.box(0.06, 0.08, 0.5, 0, 0.0, 0.0, bk); b.box(0.052, 0.04, 0.34, 0, 0.056, 0.0, M.steel()); b.tube(0.019, 0.8, 0, 0.018, -0.6, M.steel());
    for (let i = 0; i < 8; i++) b.tube(0.0215, 0.012, 0, 0.018, -0.3 - i * 0.07, M.steel()); b.box(0.05, 0.05, 0.18, 0, 0.018, -0.2, bk);
    b.box(0.07, 0.06, 0.12, 0, 0.018, -1.0, M.black()); for (const z of [-0.97, -1.0, -1.03]) b.box(0.08, 0.012, 0.012, 0, 0.018, z, M.steel());
    for (const sd of [-1, 1]) b.box(0.006, 0.04, 0.05, sd * 0.036, 0.018, -1.0, M.black());                                     // brake side ports
    bipod(b, -0.62, 0.0, 0.14); b.box(0.04, 0.03, 0.05, 0, -0.01, -0.62, M.steel());
    mark(b.box(0.04, 0.1, 0.12, 0, 0.0, 0.05, bk), 'mag');                                                                   // box mag (shown on the side)
    b.box(0.032, 0.09, 0.05, 0, -0.1, 0.22, M.poly(), -0.3); triggerGroup(b, 0, -0.045, 0.16, 0.07); b.box(0.034, 0.1, 0.46, 0, -0.016, 0.44, M.polyTan(), 0.02); b.box(0.04, 0.14, 0.016, 0, -0.02, 0.68, M.rubber());
    b.box(0.02, 0.01, 0.5, 0, 0.082, 0.0, bk); b.box(0.01, 0.05, 0.06, 0, 0.1, 0.18, bk); b.box(0.012, 0.012, 0.18, 0, 0.126, 0.18, bk);   // rail + carry handle
    scope(b, -0.02, 0.114, 0.4, 0.019, 0.03); boltK(b, 0.056, 0.03, 0.2);
    return b.done({ muzzle: V(0, 0.018, -1.06), sightY: 0.114, grip: V(0, -0.1, 0.22), fore: V(0, 0.0, -0.4), pistol: false, side: V(0.034, 0.018, -0.5), under: V(0, -0.045, -0.4) });
  };

  R.reaper = () => {                                          // Reaper: a sleek matte-black chassis rifle, shrouded fluted barrel with a huge suppressor, skeleton stock, night-glass scope
    const b = new B(), bk = C(0x16181b, 0.5, 0.4);
    b.box(0.042, 0.06, 0.32, 0, 0.012, 0.0, bk); b.box(0.046, 0.05, 0.5, 0, 0.012, -0.4, bk); for (let i = 0; i < 6; i++) b.box(0.048, 0.014, 0.03, 0, 0.012, -0.2 - i * 0.07, M.steel());
    b.tube(0.0105, 0.4, 0, 0.016, -0.75, M.steel()); b.tube(0.02, 0.32, 0, 0.016, -0.86, M.black()); for (let i = 0; i < 4; i++) b.tube(0.0215, 0.006, 0, 0.016, -0.74 - i * 0.07, M.steel());
    b.box(0.03, 0.02, 0.4, 0, 0.034, -0.4, M.blued());
    b.box(0.03, 0.08, 0.05, 0, -0.07, 0.04, bk, -0.2); b.box(0.034, 0.016, 0.18, 0, 0.0, 0.26, bk); b.box(0.034, 0.016, 0.16, 0, -0.07, 0.27, bk, -0.12); b.box(0.034, 0.1, 0.016, 0, -0.03, 0.34, M.rubber());
    b.box(0.03, 0.01, 0.16, 0, 0.04, 0.24, M.blued()); b.box(0.008, 0.07, 0.012, 0, -0.03, 0.2, M.steel());                  // cheek riser + stock struts
    mark(b.box(0.028, 0.06, 0.04, 0, -0.06, -0.06, M.black()), 'mag'); triggerGroup(b, 0, -0.04, 0.02, 0.05); boltK(b, 0.04, 0.026, 0.07);
    scope(b, -0.01, 0.076, 0.34, 0.017, 0.026); b.tube(0.017, 0.004, 0, 0.076, 0.165, M.red());
    return b.done({ muzzle: V(0, 0.016, -1.02), sightY: 0.076, grip: V(0, -0.07, 0.05), fore: V(0, -0.01, -0.3), pistol: false, side: V(0.026, 0.012, -0.5), under: V(0, -0.02, -0.4) });
  };

  R.spas12 = () => {                                          // SPAS-12: black pump with a skeleton fold-out stock with hook, heat shield over the barrel, tube mag
    const b = new B();
    b.box(0.044, 0.06, 0.26, 0, 0.0, 0.0, M.blued()); b.tube(0.0125, 0.48, 0, 0.02, -0.36, M.blued()); b.tube(0.0115, 0.44, 0, -0.012, -0.32, M.steel());
    b.box(0.03, 0.01, 0.46, 0, 0.038, -0.34, M.black()); for (let i = 0; i < 7; i++) b.box(0.034, 0.005, 0.018, 0, 0.0422, -0.14 - i * 0.06, M.steel());    // vented heat shield
    mark(b.box(0.052, 0.05, 0.16, 0, -0.012, -0.25, M.poly()), 'pump'); for (let i = 0; i < 5; i++) mark(b.box(0.055, 0.052, 0.008, 0, -0.012, -0.2 - i * 0.026, M.black()), 'pump');
    b.tube(0.0155, 0.03, 0, -0.012, -0.55, M.steel()); b.box(0.014, 0.02, 0.014, 0, 0.032, -0.6, M.blued());
    ironSights(b, { y: 0.054, zr: 0.08, zf: -0.6, br: 0.032, bf: 0.044, open: true, bead: true });
    b.box(0.034, 0.1, 0.044, 0, -0.07, 0.1, M.poly(), -0.3); triggerGroup(b, 0, -0.035, 0.04, 0.06);
    b.box(0.014, 0.012, 0.2, 0, 0.01, 0.23, M.steel()); b.box(0.014, 0.012, 0.18, 0, -0.07, 0.23, M.steel(), -0.12); b.box(0.014, 0.1, 0.012, 0, -0.03, 0.33, M.steel(), -0.1); b.box(0.014, 0.03, 0.04, 0, -0.082, 0.3, M.steel());   // skeleton stock + hook
    b.box(0.003, 0.026, 0.06, 0.0235, 0.012, 0.0, M.black());
    return b.done({ muzzle: V(0, 0.02, -0.605), sightY: 0.054, grip: V(0, -0.07, 0.1), fore: V(0, -0.012, -0.25), pistol: false, side: V(0.026, -0.012, -0.3), mount: V(0, 0.032, 0.0), under: V(0, -0.036, -0.25) });
  };

  R.ksg = () => {                                             // KSG: bullpup pump, twin magazine tubes under the barrel, carry handle with rear sight, forward grip
    const b = new B(), pl = C(0x2e3033, 0.05, 0.6);
    b.box(0.05, 0.08, 0.5, 0, 0.0, 0.1, pl); b.box(0.046, 0.06, 0.22, 0, 0.0, -0.22, pl);
    b.tube(0.0125, 0.4, 0, 0.02, -0.46, M.blued()); b.tube(0.011, 0.4, -0.016, -0.02, -0.4, M.steel()); b.tube(0.011, 0.4, 0.016, -0.02, -0.4, M.steel());
    mark(b.box(0.054, 0.05, 0.14, 0, -0.012, -0.3, M.poly()), 'pump'); for (let i = 0; i < 4; i++) mark(b.box(0.057, 0.052, 0.008, 0, -0.012, -0.26 - i * 0.026, M.black()), 'pump');
    b.box(0.014, 0.014, 0.52, 0, 0.056, 0.0, pl); b.box(0.016, 0.03, 0.02, 0, 0.044, 0.22, pl); b.box(0.012, 0.03, 0.02, 0, 0.044, -0.2, pl);
    ironSights(b, { y: 0.07, zr: 0.18, zf: -0.3, br: 0.06, bf: 0.06, open: true });
    b.box(0.034, 0.1, 0.044, 0, -0.07, -0.04, pl, -0.3); triggerGroup(b, 0, -0.035, -0.07, 0.06); b.box(0.052, 0.09, 0.016, 0, -0.004, 0.36, M.rubber());
    b.tube(0.0135, 0.04, 0, 0.02, -0.68, M.black());
    return b.done({ muzzle: V(0, 0.02, -0.7), sightY: 0.07, grip: V(0, -0.07, -0.04), fore: V(0, -0.012, -0.3), pistol: false, side: V(0.028, 0.0, -0.3), mount: V(0, 0.06, 0.1), under: V(0, -0.045, -0.3) });
  };

  R.saiga = () => {                                           // Saiga-12: AK receiver with a wide 12-gauge box mag, black polymer furniture, short barrel with a slanted brake
    const b = new B(), pl = M.poly();
    b.box(0.052, 0.066, 0.32, 0, 0.0, -0.01, M.blued()); b.box(0.048, 0.022, 0.3, 0, 0.042, 0.0, M.blued());
    b.tube(0.0135, 0.4, 0, 0.012, -0.34, M.steel()); b.tube(0.013, 0.22, 0, 0.05, -0.3, M.steel()); b.box(0.05, 0.034, 0.18, 0, 0.046, -0.3, pl); b.box(0.056, 0.044, 0.18, 0, -0.008, -0.3, pl);
    b.box(0.022, 0.06, 0.03, 0, 0.032, -0.5, M.steel()); b.tube(0.018, 0.05, 0, 0.012, -0.56, M.black()); b.box(0.04, 0.006, 0.02, 0, 0.034, -0.56, M.steel());
    ironSights(b, { y: 0.07, zr: -0.1, zf: -0.5, br: 0.053, bf: 0.062, open: true });
    for (let k = 0; k < 3; k++) mark(b.box(0.044, 0.07, 0.072, 0, -0.072 - k * 0.06, -0.03 - k * 0.002 - k * k * 0.002, M.steel(), 0.1 + k * 0.08), 'mag');
    b.box(0.032, 0.1, 0.045, 0, -0.1, 0.12, pl, -0.32); triggerGroup(b, 0, -0.04, 0.03); b.box(0.036, 0.07, 0.22, 0, -0.012, 0.27, pl, 0.04); b.box(0.04, 0.1, 0.012, 0, -0.02, 0.385, M.rubber(), 0.04);
    b.rod(0.006, 0.03, 0.036, 0.02, 0.005, M.steel());
    return b.done({ muzzle: V(0, 0.012, -0.585), sightY: 0.07, grip: V(0, -0.1, 0.12), fore: V(0, -0.025, -0.3), pistol: false, side: V(0.03, -0.006, -0.37), mount: V(0, 0.056, 0.03), under: V(0, -0.027, -0.3) });
  };

  const SL = (m) => mark(m, 'slide');
  const guard = (b, z, y, len, m) => { b.box(0.007, 0.004, len, 0, y - 0.03, z, m); b.box(0.007, 0.03, 0.005, 0, y - 0.016, z - len / 2, m); b.box(0.006, 0.02, 0.008, 0, y - 0.012, z + 0.002, M.black(), 0.25); };

  R.usp = () => {                                             // H&K USP: chunky polymer, big slide with front + rear serrations, squared trigger guard, long dust cover rail
    const b = new B(), pl = M.poly();
    SL(b.box(0.032, 0.036, 0.2, 0, 0.022, 0.0, M.blued())); for (let i = 0; i < 6; i++) SL(b.box(0.034, 0.028, 0.004, 0, 0.022, 0.07 + i * 0.01, M.black())); for (let i = 0; i < 3; i++) SL(b.box(0.034, 0.02, 0.004, 0, 0.02, -0.07 - i * 0.01, M.black()));
    SL(b.box(0.004, 0.012, 0.04, 0.017, 0.028, 0.0, M.black()));
    b.box(0.03, 0.022, 0.15, 0, -0.004, 0.012, pl); b.box(0.03, 0.016, 0.07, 0, -0.012, -0.062, pl); b.box(0.02, 0.006, 0.05, 0, -0.022, -0.065, M.black());   // frame + dust cover
    b.box(0.034, 0.095, 0.046, 0, -0.052, 0.066, pl, -0.3); b.box(0.0345, 0.01, 0.05, 0, -0.1, 0.08, M.black(), -0.3); mark(b.box(0.026, 0.05, 0.038, 0, -0.12, 0.083, M.black(), -0.3), 'mag');
    guard(b, 0.0, -0.0, 0.068, pl); b.box(0.008, 0.01, 0.014, 0, 0.044, 0.1, M.steel(), 0.4);
    ironSights(b, { y: 0.0495, zr: 0.088, zf: -0.088, br: 0.04, bf: 0.04, pistol: true, slide: true }); b.tube(0.006, 0.01, 0, 0.022, -0.103, M.steel());
    return b.done({ muzzle: V(0, 0.022, -0.108), sightY: 0.0495, grip: V(0, -0.052, 0.066), fore: V(-0.014, -0.078, 0.055), pistol: true, mount: V(0, 0.04, 0.02), under: V(0, -0.024, -0.05) });
  };

  R.five7 = () => {                                           // FN Five-seveN: slim long slide, tall flared 20-round grip, ambi controls, little front slope
    const b = new B(), pl = C(0x3b3f45, 0.05, 0.6);
    SL(b.box(0.026, 0.03, 0.222, 0, 0.022, 0.0, M.blued())); for (let i = 0; i < 4; i++) SL(b.box(0.028, 0.022, 0.004, 0, 0.022, 0.08 + i * 0.009, M.black())); SL(b.box(0.028, 0.008, 0.06, 0, 0.04, -0.05, M.steel(), 0.0));
    b.box(0.028, 0.02, 0.15, 0, -0.004, 0.012, pl); b.box(0.02, 0.008, 0.05, 0, -0.016, -0.05, pl);
    b.box(0.034, 0.115, 0.05, 0, -0.058, 0.066, pl, -0.22); b.box(0.036, 0.01, 0.054, 0, -0.118, 0.078, M.black(), -0.22); mark(b.box(0.028, 0.05, 0.042, 0, -0.14, 0.082, M.black(), -0.22), 'mag');
    guard(b, 0.0, 0.0, 0.058, pl); b.box(0.008, 0.01, 0.012, 0, 0.04, 0.108, M.steel());
    ironSights(b, { y: 0.0495, zr: 0.1, zf: -0.1, br: 0.037, bf: 0.037, pistol: true, slide: true }); b.tube(0.005, 0.014, 0, 0.022, -0.116, M.steel());
    return b.done({ muzzle: V(0, 0.022, -0.12), sightY: 0.0495, grip: V(0, -0.058, 0.066), fore: V(-0.014, -0.085, 0.055), pistol: true, mount: V(0, 0.04, 0.02), under: V(0, -0.022, -0.05) });
  };

  R.tec9 = () => {                                            // TEC-9: angular slab body, perforated barrel shroud out front, mag that sits ahead of the trigger, no-nonsense top rib
    const b = new B();
    SL(b.box(0.032, 0.04, 0.17, 0, 0.02, 0.01, M.blued())); b.box(0.034, 0.03, 0.1, 0, 0.012, -0.14, M.black());
    for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) b.box(0.004, 0.014, 0.01, sd * 0.017, 0.012, -0.1 - i * 0.016, M.steel());      // shroud holes
    b.tube(0.008, 0.05, 0, 0.012, -0.21, M.steel()); SL(b.box(0.012, 0.006, 0.17, 0, 0.044, 0.01, M.black()));
    b.box(0.03, 0.024, 0.14, 0, -0.012, 0.01, M.poly()); b.box(0.032, 0.1, 0.046, 0, -0.06, 0.066, M.poly(), -0.12);
    mark(b.box(0.03, 0.14, 0.04, 0, -0.076, -0.045, M.steel(), 0.0), 'mag'); b.box(0.034, 0.04, 0.05, 0, -0.01, -0.045, M.poly());      // forward mag
    guard(b, 0.03, 0.0, 0.05, M.poly()); b.box(0.014, 0.014, 0.02, 0, 0.05, -0.05, M.steel());
    ironSights(b, { y: 0.054, zr: 0.07, zf: -0.17, br: 0.04, bf: 0.03, pistol: true, slide: true });
    return b.done({ muzzle: V(0, 0.012, -0.235), sightY: 0.054, grip: V(0, -0.06, 0.066), fore: V(-0.014, -0.085, 0.06), pistol: true, mount: V(0, 0.044, 0.02), under: V(0, -0.03, -0.1) });
  };

  R.cz75 = () => {                                            // CZ-75: all-steel classic, slide riding inside the frame rails, exposed hammer, wooden grip panels
    const b = new B(), st = M.silver();
    SL(b.box(0.024, 0.032, 0.19, 0, 0.022, 0.0, M.blued())); for (let i = 0; i < 6; i++) SL(b.box(0.026, 0.024, 0.003, 0, 0.022, 0.07 + i * 0.008, M.black()));
    b.box(0.03, 0.022, 0.2, 0, 0.0, 0.01, M.blued()); b.box(0.028, 0.012, 0.055, 0, -0.014, -0.065, M.blued());
    b.box(0.03, 0.09, 0.044, 0, -0.054, 0.066, M.blued(), -0.28); for (const sd of [-1, 1]) b.box(0.004, 0.08, 0.04, sd * 0.017, -0.054, 0.066, M.wood(), -0.28);
    mark(b.box(0.024, 0.045, 0.036, 0, -0.112, 0.08, st, -0.28), 'mag');
    guard(b, 0.0, 0.0, 0.07, M.blued()); b.box(0.01, 0.018, 0.012, 0, 0.042, 0.104, M.steel(), 0.5);      // spur hammer
    ironSights(b, { y: 0.0485, zr: 0.088, zf: -0.082, br: 0.038, bf: 0.038, pistol: true, slide: true }); b.tube(0.0055, 0.01, 0, 0.022, -0.098, M.steel());
    return b.done({ muzzle: V(0, 0.022, -0.103), sightY: 0.0485, grip: V(0, -0.052, 0.066), fore: V(-0.014, -0.078, 0.055), pistol: true, mount: V(0, 0.038, 0.02), under: V(0, -0.024, -0.04) });
  };

  const revolverBase = (b, o) => {                           // frame, cylinder with n chambers, barrel + lug, hammer, trigger guard
    b.box(0.03, 0.055, 0.1, 0, 0.002, 0.04, o.metal); b.tube(o.cr, 0.058, 0, 0.012, -0.015, o.metal);
    for (let i = 0; i < o.n; i++) { const a = (i / o.n) * Math.PI * 2; b.box(0.007, 0.012, 0.052, Math.cos(a) * o.cr, 0.012 + Math.sin(a) * o.cr, -0.015, M.steel(), 0, 0, a); }
    b.tube(o.br, o.len, 0, 0.026, -0.044 - o.len / 2, o.metal);
    mark(b.box(0.008, 0.026, 0.014, 0, 0.034, 0.1, M.steel(), 0.5), 'hammer');
    b.box(0.006, 0.01, 0.05, 0, -0.025, 0.04, o.metal); b.box(0.006, 0.026, 0.005, 0, -0.012, 0.012, o.metal); b.box(0.005, 0.02, 0.007, 0, -0.01, 0.045, M.steel(), 0.2);
  };
  R.python = () => {                                          // Colt Python: 6" full-lug barrel with vent rib, ramp front sight, polished blued finish, walnut target grip
    const b = new B(), bl = M.blued();
    revolverBase(b, { metal: bl, cr: 0.029, n: 6, br: 0.011, len: 0.22 });
    b.box(0.014, 0.024, 0.22, 0, 0.0, -0.154, bl); b.box(0.008, 0.01, 0.22, 0, 0.044, -0.154, bl); for (let i = 0; i < 6; i++) b.box(0.01, 0.003, 0.012, 0, 0.0505, -0.07 - i * 0.034, M.black());
    b.box(0.01, 0.018, 0.02, 0, 0.042, -0.254, M.black(), 0, 0, 0); b.box(0.026, 0.01, 0.03, 0, 0.044, 0.05, M.steel());
    b.box(0.034, 0.1, 0.05, 0, -0.065, 0.098, M.wood(), -0.28); b.box(0.036, 0.016, 0.05, 0, -0.012, 0.09, M.wood());
    ironSights(b, { y: 0.0555, zr: 0.07, zf: -0.254, br: 0.05, bf: 0.044, pistol: true, open: true });
    return b.done({ muzzle: V(0, 0.026, -0.265), sightY: 0.0555, grip: V(0, -0.06, 0.092), fore: V(-0.014, -0.08, 0.08), pistol: true, mount: V(0, 0.05, 0.05), under: V(0, -0.012, -0.2) });
  };

  R.judge = () => {                                           // Taurus Judge: fat five-shot cylinder, stubby 3" barrel with a ramp front sight, soft rubber grip, matte finish
    const b = new B(), bl = C(0x23262a, 0.6, 0.45);
    revolverBase(b, { metal: bl, cr: 0.036, n: 5, br: 0.014, len: 0.075 });
    b.box(0.018, 0.02, 0.09, 0, 0.004, -0.09, bl); b.box(0.01, 0.016, 0.016, 0, 0.044, -0.12, M.red());
    b.box(0.038, 0.095, 0.054, 0, -0.065, 0.098, M.rubber(), -0.3); for (let i = 0; i < 4; i++) b.box(0.04, 0.004, 0.056, 0, -0.04 - i * 0.02, 0.098 + i * 0.006, M.black(), -0.3);
    ironSights(b, { y: 0.052, zr: 0.075, zf: -0.12, br: 0.05, bf: 0.042, pistol: true, open: true });
    return b.done({ muzzle: V(0, 0.026, -0.122), sightY: 0.052, grip: V(0, -0.062, 0.095), fore: V(-0.014, -0.082, 0.082), pistol: true, mount: V(0, 0.05, 0.05), under: V(0, 0.0, -0.1) });
  };

  R.revolver44 = () => {                                      // Model 29-style .44: stainless, 6.5" barrel with a shrouded lug and ramp sight, big wood grip, 6 shots
    const b = new B(), sl = M.silver();
    revolverBase(b, { metal: sl, cr: 0.031, n: 6, br: 0.013, len: 0.2 });
    b.box(0.016, 0.034, 0.17, 0, 0.0, -0.13, sl); b.box(0.01, 0.01, 0.2, 0, 0.043, -0.15, sl); b.box(0.012, 0.022, 0.022, 0, 0.044, -0.236, M.black());
    b.box(0.024, 0.018, 0.03, 0, 0.044, 0.05, M.black()); b.box(0.038, 0.105, 0.052, 0, -0.068, 0.098, M.wood(), -0.3); b.box(0.04, 0.008, 0.054, 0, -0.016, 0.092, M.black());
    ironSights(b, { y: 0.0535, zr: 0.05, zf: -0.236, br: 0.052, bf: 0.044, pistol: true, open: true });
    return b.done({ muzzle: V(0, 0.026, -0.245), sightY: 0.0535, grip: V(0, -0.065, 0.095), fore: V(-0.014, -0.085, 0.08), pistol: true, mount: V(0, 0.052, 0.05), under: V(0, -0.012, -0.18) });
  };

  return R;
}
