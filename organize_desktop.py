# -*- coding: utf-8 -*-
import os
import shutil
import sys

desktop = r'C:\Users\yinsu\Desktop'

# 创建目标文件夹
folders = ['合同文件', '报价清单', '项目文件', '演示文稿', '设计图纸', '证书文件', '账单费用', '文档', '视频', '代码', '安装包', '图片']
for f in folders:
    path = os.path.join(desktop, f)
    if not os.path.exists(path):
        os.makedirs(path)
        print(f'创建文件夹: {f}')

# 分类规则：扩展名 -> 文件夹
ext_map = {
    '.dwg': '设计图纸',
    '.bak': '设计图纸',
    '.drawio': '设计图纸',
    '.mp4': '视频',
    '.avi': '视频',
    '.mov': '视频',
    '.mkv': '视频',
    '.png': '图片',
    '.jpg': '图片',
    '.jpeg': '图片',
    '.gif': '图片',
    '.bmp': '图片',
    '.py': '代码',
    '.bat': '代码',
    '.sh': '代码',
    '.js': '代码',
    '.ts': '代码',
    '.exe': '安装包',
    '.msi': '安装包',
    '.pptx': '演示文稿',
    '.ppt': '演示文稿',
}

# 关键词 -> 文件夹（优先级高于扩展名）
keyword_map = [
    (['合同', '协议', '购销'], '合同文件'),
    (['报价', '清单', 'BDB', '成本'], '报价清单'),
    (['项目', '任务', '分解', '统计表', '气象局', '医院', '物联网', '数据源', '回款'], '项目文件'),
    (['证书', '签名', '嘉佰顺', '佳杰', '16783695111', '121'], '证书文件'),
    (['账单', '拍摄费用', '扫描件'], '账单费用'),
    (['金盾网络沟通与数字神经系统'], '金盾网络沟通与数字神经系统_files'),
]

# 跳过的扩展名（快捷方式等）
skip_exts = {'.lnk', '.url', '.webloc', '.desktop'}

success = 0
failed = 0
skipped = 0

# 获取桌面所有文件（非文件夹）
items = os.listdir(desktop)
files = [f for f in items if os.path.isfile(os.path.join(desktop, f))]

for fname in files:
    src = os.path.join(desktop, fname)
    ext = os.path.splitext(fname)[1].lower()
    
    # 跳过快捷方式
    if ext in skip_exts:
        skipped += 1
        continue
    
    # 跳过隐藏文件
    if fname.startswith('.'):
        skipped += 1
        continue
    
    # 确定目标文件夹
    dst_folder = None
    
    # 先按关键词匹配
    for keywords, folder in keyword_map:
        for kw in keywords:
            if kw in fname:
                dst_folder = folder
                break
        if dst_folder:
            break
    
    # 再按扩展名匹配
    if not dst_folder:
        dst_folder = ext_map.get(ext)
    
    # 特殊：.htm/.html 文件
    if not dst_folder and ext in ('.htm', '.html'):
        if '金盾' in fname:
            dst_folder = '金盾网络沟通与数字神经系统_files'
        else:
            dst_folder = '文档'
    
    # .docx/.doc/.pdf/.txt -> 文档（兜底）
    if not dst_folder and ext in ('.docx', '.doc', '.pdf', '.txt', '.rtf'):
        dst_folder = '文档'
    
    # .xlsx/.xls/.csv -> 项目文件（兜底）
    if not dst_folder and ext in ('.xlsx', '.xls', '.csv'):
        dst_folder = '项目文件'
    
    if not dst_folder:
        print(f'跳过(无分类): {fname}')
        skipped += 1
        continue
    
    dst_dir = os.path.join(desktop, dst_folder)
    dst_path = os.path.join(dst_dir, fname)
    
    if os.path.exists(dst_path):
        print(f'跳过(已存在): {fname}')
        skipped += 1
        continue
    
    try:
        shutil.move(src, dst_dir)
        print(f'OK: {fname} -> {dst_folder}')
        success += 1
    except Exception as e:
        print(f'FAIL: {fname} - {e}')
        failed += 1

print(f'\n--- 完成 ---')
print(f'成功: {success} | 失败: {failed} | 跳过: {skipped}')
