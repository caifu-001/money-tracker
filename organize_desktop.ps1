$desktop = 'C:\Users\yinsu\Desktop'

# 创建目标文件夹
$folders = @('合同文件', '报价清单', '项目文件', '演示文稿', '设计图纸', '证书文件', '账单费用', '文档', '视频', '代码', '安装包', '图片')
foreach ($f in $folders) {
    $path = Join-Path $desktop $f
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
        Write-Host "创建文件夹: $f"
    }
}

# 定义移动规则 [文件名, 目标文件夹]
$moves = @(
    # 合同文件
    @('巫溪人民嘉佰顺(证书签名)(证书签名)-副本(证书签名).pdf', '合同文件'),
    @('巫溪人民嘉佰顺(证书签名)(证书签名)-副本.pdf', '合同文件'),
    @('巫溪人民嘉佰顺(证书签名)(证书签名).pdf', '合同文件'),
    @('巫溪人民嘉佰顺(证书签名)-副本.pdf', '合同文件'),
    @('巫溪人民嘉佰顺(证书签名)-副本1(证书签名).pdf', '合同文件'),
    @('巫溪人民嘉佰顺(证书签名)-副本1.pdf', '合同文件'),
    @('巫溪人民嘉佰顺(证书签名).pdf', '合同文件'),
    @('巫溪人民嘉佰顺.pdf', '合同文件'),
    @('巫溪家佰顺合同.pdf', '合同文件'),
    @('巫溪-超融合-购销合同-v11(1).docx', '合同文件'),
    @('商品购销合同.pdf', '合同文件'),
    @('网络设备借用协议.docx', '合同文件'),
    # 报价清单
    @('【LT报价】江北 BDB清单.xlsx', '报价清单'),
    @('天融信+锐捷报价01 .xlsx', '报价清单'),
    @('锐捷成本 .xlsx', '报价清单'),
    @('锐捷报价01 .xlsx', '报价清单'),
    # 项目文件
    @('0317万州上海医院深化清单 的副本.xlsx', '项目文件'),
    @('两河流域物联网监测项目.xlsx', '项目文件'),
    @('截止2026年1月底最新在手预签订单项目统计表(4).xlsx', '项目文件'),
    @('重庆2025任务分解-跟踪5月份回款项目跟进--模板 的副本.xls', '项目文件'),
    @('重庆市气象局.xlsx', '项目文件'),
    @('2025年新品数据源.xlsx', '项目文件'),
    # 演示文稿
    @('金盾准入拓扑图.pptx', '演示文稿'),
    @('销售管理.pptx', '演示文稿'),
    # 金盾网络（已有文件夹）
    @('金盾网络沟通与数字神经系统.htm', '金盾网络沟通与数字神经系统_files'),
    # 设计图纸
    @('玻璃扶手.dwg', '设计图纸'),
    @('玻璃扶手1.dwg', '设计图纸'),
    @('平台玻璃扶手.dwg', '设计图纸'),
    @('玻璃扶手.bak', '设计图纸'),
    @('北碚网络.drawio', '设计图纸'),
    # 证书文件
    @('16783695111_(证书签名).pdf', '证书文件'),
    @('16783695111_.pdf', '证书文件'),
    @('121.pdf', '证书文件'),
    @('佳杰(1).pdf', '证书文件'),
    # 账单费用
    @('WPS扫描件_深圳向小菱跨境-拍摄费用-账单_3323_2026-02-03 10·01·33.pdf', '账单费用'),
    @('跨海时代拍摄费用账单11.xlsx', '账单费用'),
    # 文档
    @('Healspot Short Video Theme 1.docx', '文档'),
    @('新建 DOCX 文档 (3).docx', '文档'),
    @('新建 DOCX 文档.docx', '文档'),
    @('土地、房屋合法证明 (1).docx', '文档'),
    # 视频
    @('BEYOND-午夜怨曲 (89).mp4', '视频'),
    # 代码
    @('baseline.py', '代码'),
    @('xiaz37.py', '代码'),
    @('截图.bat', '代码'),
    # 安装包
    @('putty(1).exe', '安装包'),
    # 图片
    @('图片1.png', '图片'),
    @('家佰顺.png', '图片')
)

$success = 0
$failed = 0
$notfound = 0

foreach ($m in $moves) {
    $fileName = $m[0]
    $dstFolder = $m[1]
    $srcPath = Join-Path $desktop $fileName
    $dstDir = Join-Path $desktop $dstFolder
    if (Test-Path $srcPath) {
        $dstPath = Join-Path $dstDir $fileName
        if (Test-Path $dstPath) {
            Write-Host "跳过(已存在): $fileName"
        } else {
            try {
                Move-Item -Path $srcPath -Destination $dstDir -ErrorAction Stop
                Write-Host "OK: $fileName -> $dstFolder"
                $success++
            } catch {
                Write-Host "FAIL: $fileName - $_"
                $failed++
            }
        }
    } else {
        Write-Host "NOT FOUND: $fileName"
        $notfound++
    }
}
Write-Host "---"
Write-Host "成功: $success | 失败: $failed | 未找到: $notfound"
