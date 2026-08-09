export const SKIN_NAMES = [
  'neon-ghost', 'chrome-rain', 'glitch-punk', 'void-sunset', 'netrunner',
  'obsidian', 'deep-void', 'graphite', 'midnight-studio', 'eclipse',
  'redwood', 'sandstone', 'deep-ocean', 'moss-stone', 'aurora-boreal',
  'amber-terminal', 'green-screen', 'typewriter-cream', 'commodore-64', 'newsprint-noir',
  'bone-white', 'slate-mist', 'warm-ash', 'steel-thread', 'single-malt',
  'white-flash', 'solar-flare', 'black-canary', 'red-alert', 'high-noon',
  'lavender-dream', 'peach-fuzz', 'seafoam-silk', 'dusty-rose', 'baby-blue',
  'warm-parchment', 'rice-paper', 'blueprint', 'linen-sage', 'alabaster',
  'dragon-blood', 'arcane-tome', 'shadow-thief', 'enchanted-forest', 'forge-master',
  'vaporwave-mall', 'brutalist-concrete', 'stained-glass', 'desert-neon', 'liquid-silver'
];

const FALLBACK = {
  name: 'fallback',
  description: 'Neutral terminal fallback',
  colors: {
    background: '#080b10',
    ui_text: '#e6edf3',
    ui_accent: '#25d9ff',
    ui_label: '#ff3b81',
    ui_border: '#1f6f7a',
    ui_ok: '#63e67b',
    ui_error: '#ff5d68',
    ui_warn: '#ffc857',
    selection_bg: '#17313b',
    status_bar_bg: '#05070a'
  }
};

function stripQuotes(value) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function parseSkinYaml(text, expectedName) {
  const skin = { name: expectedName, description: '', colors: {} };
  let section = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;

    const top = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (top && !line.startsWith(' ')) {
      const [, key, rawValue] = top;
      if (rawValue) {
        if (key === 'name' || key === 'description') skin[key] = stripQuotes(rawValue);
        section = '';
      } else {
        section = key;
      }
      continue;
    }

    if (section === 'colors') {
      const color = line.match(/^\s{2}([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (color) skin.colors[color[1]] = stripQuotes(color[2]);
    }
  }

  return {
    ...FALLBACK,
    ...skin,
    colors: { ...FALLBACK.colors, ...skin.colors }
  };
}

export async function loadSkins(basePath = './skins') {
  const results = await Promise.all(
    SKIN_NAMES.map(async (name) => {
      try {
        const response = await fetch(`${basePath}/${name}.yaml`, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return parseSkinYaml(await response.text(), name);
      } catch (error) {
        console.warn(`Could not load ${name}:`, error);
        return { ...FALLBACK, name, description: 'Fallback palette; YAML could not be loaded.' };
      }
    })
  );
  return results;
}
