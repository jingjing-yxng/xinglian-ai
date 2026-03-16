#!/usr/bin/env python3
"""Generate a Chinese PDF installation guide for the Douyin Outreach Extension."""

from fpdf import FPDF

FONT_PATH = '/System/Library/Fonts/STHeiti Medium.ttc'

class PDF(FPDF):
    def header(self):
        self.set_font('STHeiti', '', 10)
        self.set_text_color(150, 150, 150)
        self.cell(0, 8, '抖音外联助手 - 安装指南', align='R')
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font('STHeiti', '', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'第 {self.page_no()} 页', align='C')

pdf = PDF()
pdf.add_font('STHeiti', '', FONT_PATH)
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# Title
pdf.set_font('STHeiti', '', 24)
pdf.set_text_color(220, 53, 69)
pdf.cell(0, 15, '抖音外联助手', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.set_font('STHeiti', '', 14)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 10, '安装指南', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.ln(10)

# Intro
pdf.set_font('STHeiti', '', 11)
pdf.set_text_color(50, 50, 50)
pdf.multi_cell(0, 7,
    '本指南将帮助您在 Google Chrome 浏览器上通过开发者模式安装'
    '抖音外联助手扩展程序。整个过程大约需要 2 分钟。')
pdf.ln(8)

# Prerequisites
pdf.set_font('STHeiti', '', 14)
pdf.set_text_color(40, 40, 40)
pdf.cell(0, 10, '准备工作', new_x="LMARGIN", new_y="NEXT")
pdf.set_font('STHeiti', '', 11)
pdf.set_text_color(50, 50, 50)
pdf.multi_cell(0, 7,
    '  · Google Chrome 浏览器（建议使用最新版本）\n'
    '  · 扩展程序 ZIP 压缩包（douyin-outreach-extension.zip）')
pdf.ln(8)

# Steps
steps = [
    {
        'title': '第一步：解压扩展程序',
        'body': (
            '找到您收到的 ZIP 压缩包，将其解压到电脑上的任意文件夹'
            '（例如桌面或文档文件夹）。\n\n'
            'Mac 系统：双击 ZIP 文件即可自动解压。\n'
            'Windows 系统：右键点击 ZIP 文件，选择"全部解压缩..."。\n\n'
            '解压后，您应该会看到一个名为 "douyin-outreach-extension" 的文件夹，'
            '里面包含 manifest.json、sidepanel/、content/ 等文件。\n\n'
            '重要提示：请记住这个文件夹的位置。安装完成后请勿删除或移动此文件夹，'
            'Chrome 需要它保持在原位才能正常运行。'
        )
    },
    {
        'title': '第二步：打开 Chrome 扩展程序页面',
        'body': (
            '打开 Google Chrome 浏览器，进入扩展程序管理页面。您可以通过以下两种方式操作：\n\n'
            '方式一：在地址栏中输入 chrome://extensions 然后按回车键。\n\n'
            '方式二：点击 Chrome 右上角的三个点菜单图标，'
            '然后选择"扩展程序" > "管理扩展程序"。'
        )
    },
    {
        'title': '第三步：启用开发者模式',
        'body': (
            '在扩展程序页面的右上角，找到"开发者模式"的开关按钮。\n\n'
            '点击开关将其打开，开启后按钮会变成蓝色。\n\n'
            '启用后，页面顶部会出现三个新按钮：'
            '"加载已解压的扩展程序"、"打包扩展程序"和"更新"。'
        )
    },
    {
        'title': '第四步：加载扩展程序',
        'body': (
            '点击"加载已解压的扩展程序"按钮（三个按钮中的第一个）。\n\n'
            '系统会弹出文件选择对话框，找到并选择您在第一步中解压出来的'
            ' "douyin-outreach-extension" 文件夹。\n\n'
            '重要提示：请选择文件夹本身，而不是文件夹内的某个文件。'
            '该文件夹的顶层目录中应包含 manifest.json 文件。'
        )
    },
    {
        'title': '第五步：验证安装',
        'body': (
            '加载成功后，您应该能在扩展程序列表中看到"抖音外联助手"。\n\n'
            '请确保扩展程序旁边的开关处于开启状态（蓝色）。\n\n'
            '同时，您应该能在 Chrome 工具栏（地址栏右侧区域）看到扩展程序图标。'
            '如果没有看到，请点击工具栏上的拼图图标，'
            '找到抖音外联助手并点击旁边的固定图标将其固定到工具栏。'
        )
    },
    {
        'title': '第六步：开始使用',
        'body': (
            '在 Chrome 中打开 www.douyin.com。\n\n'
            '点击工具栏中的扩展程序图标，浏览器右侧会弹出一个侧边面板，'
            '显示扩展程序的操作界面。\n\n'
            '当您在抖音页面上时，侧边面板右上角的连接状态应显示"已连接"。\n\n'
            '请先进入"设置"标签页，配置您的 DeepSeek API 密钥和其他偏好设置。'
        )
    },
]

for step in steps:
    pdf.set_font('STHeiti', '', 13)
    pdf.set_text_color(220, 53, 69)
    pdf.cell(0, 10, step['title'], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font('STHeiti', '', 11)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 7, step['body'])
    pdf.ln(6)

# Troubleshooting
pdf.add_page()
pdf.set_font('STHeiti', '', 16)
pdf.set_text_color(40, 40, 40)
pdf.cell(0, 12, '常见问题', new_x="LMARGIN", new_y="NEXT")
pdf.ln(4)

issues = [
    {
        'q': '出现 "Extension context invalidated" 错误',
        'a': '这是扩展程序重新加载或更新后的正常现象。'
             '只需刷新抖音页面即可解决（Mac 按 Cmd+R，Windows 按 Ctrl+R）。'
    },
    {
        'q': '侧边面板显示"未连接"',
        'a': '请确保您当前在 www.douyin.com 页面上。'
             '如果您刚安装或重新加载了扩展程序，请先刷新抖音页面。'
    },
    {
        'q': '工具栏中看不到扩展程序图标',
        'a': '点击 Chrome 工具栏上的拼图图标，找到抖音外联助手，'
             '然后点击旁边的固定图标将其固定到工具栏。'
    },
    {
        'q': '重启 Chrome 后扩展程序消失了',
        'a': '只要文件夹保持在原来的位置，已解压加载的扩展程序在 Chrome 重启后'
             '会继续保留。如果您移动或删除了文件夹，需要从第四步重新加载。'
    },
    {
        'q': '出现 "Manifest file is missing or unreadable" 错误',
        'a': '请确保您在第四步中选择了正确的文件夹。'
             '您选择的文件夹必须直接包含 manifest.json 文件（不是子文件夹）。'
    },
]

for issue in issues:
    pdf.set_font('STHeiti', '', 11)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(0, 8, f'问：{issue["q"]}', new_x="LMARGIN", new_y="NEXT")
    pdf.set_font('STHeiti', '', 11)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 7, f'答：{issue["a"]}')
    pdf.ln(4)

# Save
output_path = '/Users/jingjingyang/douyin-outreach-extension/安装指南.pdf'
pdf.output(output_path)
print(f'PDF saved to: {output_path}')
