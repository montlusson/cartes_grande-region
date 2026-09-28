//  FORMAT DES NOMBRES (onglet Données) — inspiré des options Datawrapper
//  (arrondi/diviser/préfixer/ajouter, + jetons de format personnalisé) —
//  un seul réglage, appliqué partout où une valeur CSV est affichée :
//  infobulle ({{valeur}}, js/09 _ttContext), légende (js/08 _legendFmtNum)
//  et tableau de données (js/09 _openTableModal). Ne concerne PAS les
//  couches Bibliothèque, qui ont leur propre légende à l'échelle propre à
//  chaque jeu de données importé (js/20 _fmtChoroNum, inchangé).
// ══════════════════════════════════════════════════════════════════

var NUM_LOCALE_TAGS = { fr: 'fr-FR', de: 'de-DE', en: 'en-US', ch: 'de-CH' };

function _numLocaleTag() {
  if (_numLocale === 'auto') return undefined; // langue du navigateur
  return NUM_LOCALE_TAGS[_numLocale] || 'fr-FR';
}

// Jetons de format personnalisé (sous-ensemble de la syntaxe Datawrapper —
// https://www.datawrapper.de/academy/custom-number-formats-that-you-can-display-in-datawrapper) :
//   0.0 / 0.00…    décimales fixes         0.[0] / 0.[00]…  décimales max (zéros
//   0,0             grouper les milliers     non significatifs retirés)
//   0%              signe pourcentage        (0)   valeurs négatives entre parenthèses
//   +0              signe + devant le positif  |0|  retire le signe moins
function _parseCustomNumFormat(tpl) {
  var s = String(tpl || '').trim();
  var percent = /%$/.test(s); if (percent) s = s.slice(0, -1);
  var parens = /^\(.*\)$/.test(s); if (parens) s = s.slice(1, -1);
  var forcePlus = /^\+/.test(s); if (forcePlus) s = s.slice(1);
  var noSign = /^\|.*\|$/.test(s); if (noSign) s = s.slice(1, -1);
  var grouped = /^0[,;]0/.test(s);
  s = s.replace(/^0[,;]0/, '0');
  var decimalMode = 'auto', decimals = 0;
  var mMax = /^0\.\[(0+)\]$/.exec(s);
  var mFixed = /^0\.(0+)$/.exec(s);
  if (mMax) { decimalMode = 'max'; decimals = mMax[1].length; }
  else if (mFixed) { decimalMode = 'fixed'; decimals = mFixed[1].length; }
  else if (/^0$/.test(s)) { decimalMode = 'fixed'; decimals = 0; }
  return { percent: percent, parens: parens, forcePlus: forcePlus, noSign: noSign,
           grouped: grouped, decimalMode: decimalMode, decimals: decimals };
}

// Formate un nombre déjà résolu (diviseur/preset appliqués par _formatValue)
// selon un jeton personnalisé et une locale de sortie.
function _applyCustomNumFormat(n, parsed, localeTag) {
  var negative = n < 0;
  var abs = Math.abs(n);
  var opts = { useGrouping: !!parsed.grouped };
  if (parsed.decimalMode === 'fixed') { opts.minimumFractionDigits = parsed.decimals; opts.maximumFractionDigits = parsed.decimals; }
  else if (parsed.decimalMode === 'max') { opts.maximumFractionDigits = parsed.decimals; }
  else { opts.maximumFractionDigits = 2; }
  var out = new Intl.NumberFormat(localeTag, opts).format(abs);
  if (parsed.percent) out += '%';
  if (negative && !parsed.noSign) out = parsed.parens ? '(' + out + ')' : '−' + out;
  else if (!negative && parsed.forcePlus) out = '+' + out;
  return out;
}

// Point d'entrée unique — à appeler partout où une valeur CSV est affichée.
// Texte non numérique (ex. « Parti vainqueur » en mode catégoriel) : rendu
// tel quel, sans préfixe/suffixe (qui n'auraient pas de sens dessus).
function _formatValue(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  var n = parseFloat(String(raw).trim().replace(',', '.'));
  if (isNaN(n)) return String(raw);

  var localeTag = _numLocaleTag();
  var out;
  if (_numFormatPreset === 'custom' && _numFormatCustom.trim()) {
    out = _applyCustomNumFormat(n, _parseCustomNumFormat(_numFormatCustom), localeTag);
  } else {
    var opts = { useGrouping: false };
    switch (_numFormatPreset) {
      case 'int':      opts = { useGrouping: false, maximumFractionDigits: 0 }; break;
      case 'dec1':      opts = { useGrouping: false, minimumFractionDigits: 1, maximumFractionDigits: 1 }; break;
      case 'dec2':      opts = { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }; break;
      case 'grouped':   opts = { useGrouping: true,  maximumFractionDigits: 0 }; break;
      case 'grouped2':  opts = { useGrouping: true,  minimumFractionDigits: 2, maximumFractionDigits: 2 }; break;
      case 'percent':   opts = { useGrouping: false, maximumFractionDigits: 0 }; break;
      default:          // auto — même logique que l'ancien _fmtChoroNum (js/20) :
                         // entier si le nombre l'est déjà, sinon 1 décimale.
        opts = { useGrouping: true, maximumFractionDigits: (Math.round(n) === n ? 0 : 1) };
    }
    out = new Intl.NumberFormat(localeTag, opts).format(n);
    if (_numFormatPreset === 'percent') out += '%';
  }

  // Pas d'espace deviné automatiquement — l'auteur le tape lui-même dans
  // le champ s'il le veut (ex. " €"), comme chez Datawrapper. Les boutons
  // de devise (ci-dessous) insèrent déjà l'espacement d'usage.
  if (_numPrefix) out = _numPrefix + out;
  if (_numSuffix) out = out + _numSuffix;
  return out;
}

// Aperçu en direct (panneau Données) — un nombre à décimales et un nombre
// négatif, pour que l'effet des jetons (0), +0, |0| reste visible.
function _numFormatPreviewText() {
  return _formatValue(1234567.891) + '   /   ' + _formatValue(-42.5);
}

function _updateNumFormatPreview() {
  var el = document.getElementById('num-format-preview');
  if (el) el.textContent = _numFormatPreviewText();
}

// Un seul point de rafraîchissement après tout changement de réglage —
// touche les trois endroits où une valeur formatée s'affiche (infobulle,
// légende) plus l'aperçu du panneau lui-même ; le tableau (js/09
// _openTableModal) se recalcule de lui-même à la prochaine ouverture.
function _refreshNumFormat() {
  _updateNumFormatPreview();
  _refreshTooltip();
  _updateLegend();
}

function _wireNumFormat() {
  var presetSel  = document.getElementById('num-format-preset');
  var customWrap = document.getElementById('num-format-custom-wrap');
  var customInp  = document.getElementById('num-format-custom');
  var localeSel  = document.getElementById('num-format-locale');
  var prefixInp  = document.getElementById('num-format-prefix');
  var suffixInp  = document.getElementById('num-format-suffix');
  if (!presetSel) return;

  presetSel.addEventListener('change', function() {
    _numFormatPreset = this.value;
    customWrap.style.display = (this.value === 'custom') ? 'block' : 'none';
    _refreshNumFormat();
  });
  customInp.addEventListener('input', function() { _numFormatCustom = this.value; _refreshNumFormat(); });
  localeSel.addEventListener('change', function() { _numLocale = this.value; _refreshNumFormat(); });
  prefixInp.addEventListener('input', function() { _numPrefix = this.value; _refreshNumFormat(); });
  suffixInp.addEventListener('input', function() { _numSuffix = this.value; _refreshNumFormat(); });

  document.querySelectorAll('[data-currency]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var field = (btn.dataset.target === 'prefix') ? prefixInp : suffixInp;
      field.value = btn.dataset.currency;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  var clearBtn = document.getElementById('btn-num-format-clear');
  if (clearBtn) clearBtn.addEventListener('click', function() {
    prefixInp.value = ''; suffixInp.value = '';
    _numPrefix = ''; _numSuffix = '';
    _refreshNumFormat();
  });

  _updateNumFormatPreview();
}
