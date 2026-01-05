"""Documentation Routes - PDF generation for API documentation"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from typing import Dict
import os
import markdown
try:
    from xhtml2pdf import pisa
except ImportError:
    pisa = None
import io
import logging

from core.security import get_current_gerant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/docs", tags=["Documentation"])


@router.get("/integrations.pdf")
async def get_integrations_pdf(
    current_user: Dict = Depends(get_current_gerant)
):
    """
    Generate and download the API Integrations notice as PDF.
    Requires gérant authentication.
    """
    if pisa is None:
        raise HTTPException(
            status_code=500,
            detail="PDF generation library not available. Please install xhtml2pdf."
        )
    
    try:
        # Get the markdown file path
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        md_path = os.path.join(base_dir, "docs", "NOTICE_API_INTEGRATIONS.md")
        
        if not os.path.exists(md_path):
            raise HTTPException(status_code=404, detail="Documentation file not found")
        
        # Read markdown file
        with open(md_path, "r", encoding="utf-8") as f:
            md_content = f.read()
        
        # Convert markdown to HTML
        html_content = markdown.markdown(
            md_content,
            extensions=['extra', 'codehilite', 'tables', 'toc']
        )
        
        # Add CSS styling for PDF
        styled_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    font-size: 11pt;
                    line-height: 1.6;
                    color: #333;
                    margin: 20px;
                }}
                h1 {{
                    color: #4F46E5;
                    border-bottom: 3px solid #4F46E5;
                    padding-bottom: 10px;
                    page-break-after: avoid;
                }}
                h2 {{
                    color: #6366F1;
                    margin-top: 30px;
                    page-break-after: avoid;
                }}
                h3 {{
                    color: #818CF8;
                    margin-top: 20px;
                    page-break-after: avoid;
                }}
                h4 {{
                    color: #A5B4FC;
                    margin-top: 15px;
                    page-break-after: avoid;
                }}
                code {{
                    background-color: #F3F4F6;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                    font-size: 10pt;
                }}
                pre {{
                    background-color: #1F2937;
                    color: #F9FAFB;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                    page-break-inside: avoid;
                }}
                pre code {{
                    background-color: transparent;
                    color: inherit;
                    padding: 0;
                }}
                table {{
                    border-collapse: collapse;
                    width: 100%;
                    margin: 15px 0;
                    page-break-inside: avoid;
                }}
                th, td {{
                    border: 1px solid #D1D5DB;
                    padding: 8px;
                    text-align: left;
                }}
                th {{
                    background-color: #F3F4F6;
                    font-weight: bold;
                }}
                blockquote {{
                    border-left: 4px solid #4F46E5;
                    padding-left: 15px;
                    margin: 15px 0;
                    color: #6B7280;
                    font-style: italic;
                }}
                a {{
                    color: #4F46E5;
                    text-decoration: none;
                }}
                ul, ol {{
                    margin: 10px 0;
                    padding-left: 30px;
                }}
                li {{
                    margin: 5px 0;
                }}
                .page-break {{
                    page-break-before: always;
                }}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """
        
        # Convert HTML to PDF
        pdf_buffer = io.BytesIO()
        pisa_status = pisa.CreatePDF(
            styled_html,
            dest=pdf_buffer,
            encoding='utf-8'
        )
        
        if pisa_status.err:
            logger.error(f"PDF generation error: {pisa_status.err}")
            raise HTTPException(status_code=500, detail="Failed to generate PDF")
        
        pdf_buffer.seek(0)
        pdf_content = pdf_buffer.read()
        
        # Return PDF response
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=NOTICE_API_INTEGRATIONS.pdf"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

