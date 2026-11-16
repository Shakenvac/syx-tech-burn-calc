# Builds the page from the template, inlining the game icons and the leather/paper tabs.
# clay-calculator.html is the private claude.ai copy; index.html is the public GitHub Pages copy,
# which also gets the GoatCounter page-view counter (no cookies, no personal data).
import json, pathlib
here = pathlib.Path(__file__).parent
icons = json.loads((here / 'icons.json').read_text())
tpl = (here / 'clay-calculator.template.html').read_text(encoding='utf-8')
tabs = (here / 'burn-tabs.js').read_text(encoding='utf-8')
out = tpl.replace('__ICONS__', json.dumps(icons)).replace('__BURN_TABS__', '<script>\n' + tabs + '\n</script>')

COUNTER_NOTE = '\n    <span class="ver">Page views are counted with <a href="https://www.goatcounter.com/">GoatCounter</a>: no cookies, no personal data.</span>'
COUNTER = '\n<script data-goatcounter="https://syx-tech-burn.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>\n'

(here.parent / 'clay-calculator.html').write_text(out.replace('__COUNTER_NOTE__', ''), encoding='utf-8')
(here.parent / 'index.html').write_text(out.replace('__COUNTER_NOTE__', COUNTER_NOTE) + COUNTER, encoding='utf-8')
print('built', len(out))
