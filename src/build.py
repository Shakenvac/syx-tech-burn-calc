# Builds clay-calculator.html from the template, inlining the game icons and the leather/paper tabs.
import json, pathlib
here = pathlib.Path(__file__).parent
icons = json.loads((here / 'icons.json').read_text())
tpl = (here / 'clay-calculator.template.html').read_text(encoding='utf-8')
tabs = (here / 'burn-tabs.js').read_text(encoding='utf-8')
out = tpl.replace('__ICONS__', json.dumps(icons)).replace('__BURN_TABS__', '<script>\n' + tabs + '\n</script>')
(here.parent / 'clay-calculator.html').write_text(out, encoding='utf-8')
(here.parent / 'index.html').write_text(out, encoding='utf-8')  # GitHub Pages entry point
print('built', len(out))
