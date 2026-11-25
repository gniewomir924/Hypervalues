#!/usr/bin/env python3
"""Run from the repo root:  python3 apply_custom_results.py
Makes Custom Results work like Start (no questions, pick values from an icon list).
Safe to run twice. Works with LF or CRLF files."""
import os, re, sys

def rd(p): return open(p, encoding='utf8', newline=None).read()      # newline=None -> \n
def wr(p, t): open(p, 'w', encoding='utf8', newline='\n').write(t)

for f in ('index.html', 'Instruction.html', 'results.html', 'data.js', 'scoring.js'):
    if not os.path.exists(f):
        sys.exit(f'{f} not found - run this from the repo root')

PICK = '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Pick a value</title>\n    <link rel="stylesheet" href="style.css">\n    <link rel="icon" type="image/svg+xml" href="icon.svg">\n    <script src="theme.js"></script>\n    <script src="linebreak.js"></script>\n</head>\n<body>\n    <div class="main-container">\n        <div class="question-container">\n            <h2 id="question"></h2>\n        </div>\n\n        <div id="pick-list" class="values-flex-container"></div>\n\n        <div id="buttons"></div>\n    </div>\n\n    <script src="data.js"></script>\n    <script src="scoring.js"></script>\n    <script>\n        // Custom Results: the same step as quiz.html (one category, one value added), but the value is picked\n        // from a visual list instead of being reached by answering questions.\n        const params = new URLSearchParams(window.location.search);\n        const category = params.get(\'cat\');\n        const answers = HV.loadAnswers();\n\n        function backToList() {\n            window.location.href = `results.html#cat-${category}`;\n        }\n\n        // hasOwnProperty: keys such as "constructor" or "__proto__" must not count as categories\n        if (!category || !Object.prototype.hasOwnProperty.call(resultsMapping, category)) {\n            window.location.replace(\'results.html\');\n        } else {\n            document.getElementById(\'question\').innerText = `Pick a value: ${categoryTitles[category] || category}`;\n\n            const list = document.getElementById(\'pick-list\');\n            Object.keys(resultsMapping[category]).forEach(id => {\n                const name = HV.nameOf(category, id);\n                const added = (answers[category] || []).find(item => item.value === id);\n\n                const tile = document.createElement(\'a\');\n                tile.className = \'result-item\';\n                tile.href = \'#\';\n                tile.title = name;\n                tile.style.textDecoration = \'none\';\n                tile.style.color = \'inherit\';\n                tile.onclick = event => {\n                    event.preventDefault();\n                    addValue(id);\n                };\n\n                const img = document.createElement(\'img\');\n                img.src = `icons/${category}/${id}.svg`;\n                img.className = \'result-icon\';\n                img.alt = \'\';\n                img.onerror = () => { img.style.display = \'none\'; };\n                if (added) {\n                    // already in your list: same ring as on the results screen\n                    img.style.borderRadius = \'50%\';\n                    img.style.boxShadow = `0 0 0 3px var(--bg-color), 0 0 0 6px ${HV.ringColor(added.agree)}`;\n                }\n\n                const label = document.createElement(\'p\');\n                label.className = \'result-text\';\n                setName(label, name);\n\n                tile.append(img, label);\n                if (added) {\n                    const agree = document.createElement(\'p\');\n                    agree.className = \'result-agree\';\n                    agree.textContent = HV.signed(added.agree);\n                    tile.appendChild(agree);\n                }\n                list.appendChild(tile);\n            });\n            fitNames();\n\n            const back = document.createElement(\'button\');\n            back.innerText = \'Back\';\n            back.onclick = backToList;\n            document.getElementById(\'buttons\').appendChild(back);\n        }\n\n        // same rule as quiz.js: a new value matches you (+1); one picked again after being neutral or opposite matches again\n        function addValue(valueId) {\n            const items = answers[category] || (answers[category] = []);\n            const existing = items.find(item => item.value === valueId);\n            if (!existing) {\n                items.push({ value: valueId, agree: 1 });\n            } else if (!(existing.agree > 0)) {\n                existing.agree = 1;\n            }\n            HV.saveAnswers(answers);\n            backToList();\n        }\n    </script>\n</body>\n</html>\n'
wr('pick.html', PICK)

# 1. index.html: Custom Results button -> Instruction page in custom mode
t = rd('index.html')
t, n = re.subn(r"location\.href\s*=\s*'custom\.html'", "location.href='Instruction.html?mode=custom'", t)
if n == 0 and 'Instruction.html?mode=custom' not in t:
    # no Custom Results button yet: add one right after the Start button
    t, n = re.subn(r"([ \t]*)(<button[^>]*Instruction\.html'[^>]*>\s*Start\s*</button>[^\n]*\n)",
                   lambda m: m.group(0) + m.group(1) + "<button onclick=\"location.href='Instruction.html?mode=custom'\">Custom Results</button>\n", t, count=1)
    if n == 0: sys.exit('index.html: could not find the Start button to put Custom Results next to')
wr('index.html', t)

# 2. Instruction.html: custom mode text + set hvResultMode
t = rd('Instruction.html')
if 'customMode' not in t:
    block = ("        // Custom Results shares this page: same categories, but values are picked from a visual list\n"
             "        const customMode = new URLSearchParams(location.search).get('mode') === 'custom';\n"
             "        if (customMode) {\n"
             "            document.getElementById('question').innerText = 'You will see a list of categories. In each one, click \"Add new value\" and pick a value from the visual list; no questions are asked. You can add several values per category and click any value to say how much it matches you, from -1 (opposite) to +1 (match). Your closest ideologies update as you go.';\n"
             "        }\n\n")
    t = block + "\n" + t if False else t
    # wrapper placed after the page's own startQuiz(): works whatever startQuiz() contains,
    # because the page only navigates after the function returns
    wrapper = ("        // Custom Results: mark the session as custom once the page's own startQuiz() has cleared the old answers\n"
               "        if (typeof startQuiz === 'function') {\n"
               "            const originalStartQuiz = startQuiz;\n"
               "            startQuiz = function () {\n"
               "                originalStartQuiz();\n"
               "                try { if (customMode) localStorage.setItem('hvResultMode', 'custom'); else localStorage.removeItem('hvResultMode'); } catch (e) { /* no storage */ }\n"
               "            };\n"
               "        }\n")
    i = t.rfind('</script>')
    if i < 0: sys.exit('Instruction.html: no <script> block found')
    t = t[:i] + block + wrapper + "    " + t[i:]
    if "id=\"question\"" not in t and "id='question'" not in t: print('WARNING: Instruction.html has no #question element')
    wr('Instruction.html', t)

# 2b. upgrade from the previous script version: Start must also clear custom mode
t = rd('Instruction.html')
old = "try { if (customMode) localStorage.setItem('hvResultMode', 'custom'); } catch (e) { /* no storage */ }"
if old in t:
    t = t.replace(old, "try { if (customMode) localStorage.setItem('hvResultMode', 'custom'); else localStorage.removeItem('hvResultMode'); } catch (e) { /* no storage */ }")
    wr('Instruction.html', t)
    print('Instruction.html: upgraded')

# 3. results.html: "Add new value" -> pick.html in custom mode
t = rd('results.html')
t, n = re.subn(r"makeTile\(`quiz\.html\?cat=\$\{category\}`\)",
               "makeTile(`${isCustomResult() ? 'pick' : 'quiz'}.html?cat=${category}`)", t)
if n == 0 and "'pick' : 'quiz'" not in t: sys.exit('results.html: Add new value tile not found')
# older results.html versions have no isCustomResult(): define it (must be a real definition, not just a call)
if not re.search(r"(const|let|var|function)\s+isCustomResult\b", t):
    m = re.search(r"<script>[ \t]*\n", t)   # first inline script
    if not m: sys.exit('results.html: no inline <script> found')
    t = t[:m.end()] + "        const isCustomResult = () => { try { return localStorage.getItem('hvResultMode') === 'custom'; } catch (e) { return false; } };\n" + t[m.end():]
    print('results.html: added missing isCustomResult()')
wr('results.html', t)

# 4b. share_image.js: "CUSTOM" badge on the downloaded result picture
if os.path.exists('share_image.js'):
    t = rd('share_image.js')
    if "'CUSTOM'" not in t:
        anchor = re.search(r"^([ \t]*)ctx\.fillText\(version,[^\n]*\n", t, re.M)
        if not anchor:
            print('WARNING: share_image.js: could not find where the version is drawn - CUSTOM badge NOT added')
        else:
            badge = """        if (localStorage.getItem('hvResultMode') === 'custom') {
            const badgeX = x + titleW + 14 + ctx.measureText(version).width + 18;
            const badgeY = y + (compact ? 25 : 29);
            roundRect(ctx, badgeX, badgeY, 112, 34, 17);
            ctx.fillStyle = th.card;
            ctx.fill();
            ctx.strokeStyle = th.border;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = th.text;
            ctx.font = font(BOLD, 18);
            ctx.textAlign = 'center';
            ctx.fillText('CUSTOM', badgeX + 56, badgeY + 23);
            ctx.textAlign = 'left';
        }
"""
            t = t[:anchor.end()] + badge + t[anchor.end():]
            wr('share_image.js', t)
            print('share_image.js: CUSTOM badge added')

# 4. remove the old custom page
if os.path.exists('custom.html'): os.remove('custom.html')
print('done: pick.html added, index/Instruction/results edited, custom.html removed')
