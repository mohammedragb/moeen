#!/usr/bin/env python3
"""استخدمه قبل كل رفع إلى GitHub:  python3 bump_version.py 17
يحدّث رقم الإصدار في sw.js و index.html و version.json معًا لتصل النسخة الجديدة لكل المستخدمين."""
import re, sys
v = sys.argv[1]
t = open('sw.js', encoding='utf-8').read(); t = re.sub(r"const CACHE = 'moeen-v\d+'", "const CACHE = 'moeen-v%s'" % v, t); open('sw.js', 'w', encoding='utf-8').write(t)
t = open('index.html', encoding='utf-8').read(); t = re.sub(r"window.MOEEN_VERSION = '\d+'", "window.MOEEN_VERSION = '%s'" % v, t); open('index.html', 'w', encoding='utf-8').write(t)
open('version.json', 'w').write('{"v":"%s"}\n' % v)
print('تم ضبط الإصدار', v)
