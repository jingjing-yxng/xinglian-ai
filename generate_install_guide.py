#!/usr/bin/env python3
"""Generate a PDF installation guide for the XingLian AI."""

from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(150, 150, 150)
        self.cell(0, 8, 'XingLian AI - Installation Guide', align='R')
        self.ln(12)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', '', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Page {self.page_no()}', align='C')

pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=20)
pdf.add_page()

# Title
pdf.set_font('Helvetica', 'B', 24)
pdf.set_text_color(220, 53, 69)
pdf.cell(0, 15, 'XingLian AI', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.set_font('Helvetica', '', 14)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 10, 'Installation Guide', align='C', new_x="LMARGIN", new_y="NEXT")
pdf.ln(10)

# Intro
pdf.set_font('Helvetica', '', 11)
pdf.set_text_color(50, 50, 50)
pdf.multi_cell(0, 6,
    'This guide will walk you through installing the XingLian AI '
    'on Google Chrome using Developer Mode. The process takes about 2 minutes.')
pdf.ln(8)

# Prerequisites
pdf.set_font('Helvetica', 'B', 14)
pdf.set_text_color(40, 40, 40)
pdf.cell(0, 10, 'Prerequisites', new_x="LMARGIN", new_y="NEXT")
pdf.set_font('Helvetica', '', 11)
pdf.set_text_color(50, 50, 50)
pdf.multi_cell(0, 6,
    '  - Google Chrome browser (latest version recommended)\n'
    '  - The extension ZIP file (xinglian-ai.zip)')
pdf.ln(8)

# Steps
steps = [
    {
        'title': 'Step 1: Unzip the Extension',
        'body': (
            'Locate the ZIP file you received and unzip/extract it to a folder on your computer. '
            'You can put it anywhere you like (e.g., your Desktop or Documents folder).\n\n'
            'On Mac: Double-click the ZIP file to extract it.\n'
            'On Windows: Right-click the ZIP file and select "Extract All...".\n\n'
            'You should now have a folder called "xinglian-ai" containing '
            'files like manifest.json, sidepanel/, content/, etc.\n\n'
            'IMPORTANT: Remember where this folder is located. Do NOT delete or move this '
            'folder after installing - Chrome needs it to stay in place.'
        )
    },
    {
        'title': 'Step 2: Open Chrome Extensions Page',
        'body': (
            'Open Google Chrome and navigate to the extensions page. You can do this in two ways:\n\n'
            'Option A: Type chrome://extensions into the address bar and press Enter.\n\n'
            'Option B: Click the three-dot menu icon in the top-right corner of Chrome, '
            'then go to Extensions > Manage Extensions.'
        )
    },
    {
        'title': 'Step 3: Enable Developer Mode',
        'body': (
            'On the Extensions page, look for the "Developer mode" toggle switch in the '
            'top-right corner of the page.\n\n'
            'Click the toggle to turn it ON. It should turn blue when enabled.\n\n'
            'Once enabled, you will see three new buttons appear at the top: '
            '"Load unpacked", "Pack extension", and "Update".'
        )
    },
    {
        'title': 'Step 4: Load the Extension',
        'body': (
            'Click the "Load unpacked" button (the first of the three buttons).\n\n'
            'A file picker dialog will appear. Navigate to and select the '
            '"xinglian-ai" folder that you extracted in Step 1.\n\n'
            'IMPORTANT: Select the FOLDER itself, not any individual file inside it. '
            'The folder should contain manifest.json at its top level.'
        )
    },
    {
        'title': 'Step 5: Verify Installation',
        'body': (
            'After loading, you should see the extension appear in your extensions list '
            'with the name "XingLian AI" (or its Chinese name).\n\n'
            'Make sure the toggle switch next to the extension is turned ON (blue).\n\n'
            'You should also see the extension icon appear in your Chrome toolbar '
            '(top-right area, near the address bar). If you don\'t see it, click the '
            'puzzle piece icon to find it and pin it to the toolbar.'
        )
    },
    {
        'title': 'Step 6: Start Using the Extension',
        'body': (
            'Navigate to www.douyin.com in Chrome.\n\n'
            'Click the extension icon in your toolbar. A side panel will open on the '
            'right side of your browser showing the extension interface.\n\n'
            'The connection status in the top-right of the side panel should show '
            '"Connected" (or the Chinese equivalent) when you are on a Douyin page.\n\n'
            'Go to the Settings tab first to configure your Kimi API key and other preferences.'
        )
    },
]

for step in steps:
    pdf.set_font('Helvetica', 'B', 13)
    pdf.set_text_color(220, 53, 69)
    pdf.cell(0, 10, step['title'], new_x="LMARGIN", new_y="NEXT")
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 6, step['body'])
    pdf.ln(6)

# Troubleshooting
pdf.add_page()
pdf.set_font('Helvetica', 'B', 16)
pdf.set_text_color(40, 40, 40)
pdf.cell(0, 12, 'Troubleshooting', new_x="LMARGIN", new_y="NEXT")
pdf.ln(4)

issues = [
    {
        'q': '"Extension context invalidated" error',
        'a': 'This happens when the extension is reloaded or updated. Simply refresh '
             'the Douyin tab (Cmd+R on Mac, Ctrl+R on Windows) to fix it.'
    },
    {
        'q': 'Side panel shows "Not Connected"',
        'a': 'Make sure you are on a www.douyin.com page. If you just installed or '
             'reloaded the extension, refresh the Douyin tab first.'
    },
    {
        'q': 'Extension icon not visible in toolbar',
        'a': 'Click the puzzle piece icon in Chrome\'s toolbar, find XingLian AI, '
             'and click the pin icon next to it to pin it to your toolbar.'
    },
    {
        'q': 'Extension disappeared after Chrome restart',
        'a': 'Unpacked extensions stay installed across Chrome restarts as long as the '
             'folder remains in the same location. If you moved or deleted the folder, '
             'you will need to load it again from Step 4.'
    },
    {
        'q': '"Manifest file is missing or unreadable" error',
        'a': 'Make sure you selected the correct folder in Step 4. The folder you select '
             'must directly contain the manifest.json file (not a subfolder).'
    },
]

for issue in issues:
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(50, 50, 50)
    pdf.cell(0, 8, f'Q: {issue["q"]}', new_x="LMARGIN", new_y="NEXT")
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(0, 6, f'A: {issue["a"]}')
    pdf.ln(4)

# Save
output_path = '/Users/jingjingyang/xinglian-ai/Installation_Guide.pdf'
pdf.output(output_path)
print(f'PDF saved to: {output_path}')
