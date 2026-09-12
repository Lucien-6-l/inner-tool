import re
with open('dist/assets/index-DHLaeDgh.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 搜索inner-tool相关的路径
matches = re.findall(r'["\']([^"\']*inner-tool[^"\']*)["\']', js)
print('Strings containing inner-tool:')
for m in sorted(set(matches)):
    print(' ', m)

# 搜索可能的base路径
print()
print('Looking for history base...')
# createWebHistory在压缩后可能是别的名字，搜索/inner-tool/
idx = js.find('/inner-tool/')
if idx >= 0:
    print('Found /inner-tool/ at index', idx)
    print('Context:', js[max(0,idx-50):idx+50])
