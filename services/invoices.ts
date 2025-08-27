import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Invoice, Language } from '../types';
import { formatCurrency } from '../utils/formatting';
import { AMIRI_FONT_BASE64 } from './amiriFont';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
  addFileToVFS: (filename: string, data: string) => jsPDF;
}

const INVOICE_TERMS = {
    en: {
        invoice: "INVOICE",
        invoiceNo: "Invoice #",
        date: "Date",
        billedTo: "Billed To:",
        item: "Item",
        quantity: "Quantity",
        unitPrice: "Unit Price",
        total: "Total",
        subtotal: "Subtotal:",
        discount: "Discount:",
        grandTotal: "Total:",
        depositPaid: "Deposit Paid:",
        balanceDue: "Balance Due:",
        thankYou: "Thank you for your business!",
    },
    ar: {
        invoice: "فاتورة",
        invoiceNo: "رقم الفاتورة:",
        date: "التاريخ:",
        billedTo: "فاتورة إلى:",
        item: "الصنف",
        quantity: "الكمية",
        unitPrice: "سعر الوحدة",
        total: "الإجمالي",
        subtotal: "المجموع الفرعي:",
        discount: "خصم:",
        grandTotal: "الإجمالي:",
        depositPaid: "عربون مدفوع:",
        balanceDue: "المبلغ المتبقي:",
        thankYou: "نشكركم على تعاملكم معنا!",
    }
};


export const generateInvoicePdf = ({ order, customer, settings, issueDate, language }: Omit<Invoice, 'id' | 'orderId'> & { language: Language }) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const isArabic = language === 'ar';
    const terms = INVOICE_TERMS[language];
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;

    if (isArabic) {
        doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_FONT_BASE64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
    }

    // Function to handle RTL text.
    // FIX: Removed manual string reversal. The combination of an Arabic font
    // and the `align: 'right'` property handles RTL text correctly.
    const rtlText = (text: string, x: number, y: number, options = {}) => {
        if (isArabic) {
            doc.text(text, x, y, { align: 'right', ...options });
        } else {
            doc.text(text, x, y, options);
        }
    };
    
    // 1. Header
    doc.setFontSize(20);
    rtlText(settings.companyName, isArabic ? pageW - margin : margin, 22);
    doc.setFontSize(10);
    rtlText(settings.companyAddress, isArabic ? pageW - margin : margin, 30);
    rtlText(settings.companyPhone, isArabic ? pageW - margin : margin, 35);

    doc.setFontSize(16);
    rtlText(terms.invoice, isArabic ? margin : pageW - margin, 22, isArabic ? {align: 'left'} : {align: 'right'});
    
    // 2. Invoice Details
    doc.setFontSize(10);
    rtlText(`${terms.invoiceNo} ${order.id.substring(0, 8)}`, isArabic ? margin : pageW - margin, 30, isArabic ? {align: 'left'} : {align: 'right'});
    rtlText(`${terms.date} ${issueDate.toLocaleDateString()}`, isArabic ? margin : pageW - margin, 35, isArabic ? {align: 'left'} : {align: 'right'});

    // 3. Customer Details
    doc.rect(margin, 45, 80, 25);
    rtlText(terms.billedTo, isArabic ? margin + 78 : margin + 2, 50, isArabic ? {align: 'right'} : {});
    doc.setFontSize(10);
    rtlText(customer.fullName, isArabic ? margin + 78 : margin + 2, 56, isArabic ? {align: 'right'} : {});
    rtlText(customer.address, isArabic ? margin + 78 : margin + 2, 61, isArabic ? {align: 'right'} : {});
    rtlText(customer.phoneNumber, isArabic ? margin + 78 : margin + 2, 66, isArabic ? {align: 'right'} : {});
    
    // 4. Order Items Table
    const tableColumn = [terms.item, terms.quantity, terms.unitPrice, terms.total];
    const tableRows: any[] = [];
    
    const reversedColumn = [...tableColumn].reverse();

    order.items.forEach(item => {
        // FIX: Do not reverse the item name string. The font handles rendering.
        let itemData = [
            item.name,
            item.qty,
            formatCurrency(item.unitPrice),
            formatCurrency(item.lineTotal)
        ];
        if(isArabic) itemData.reverse(); // This correctly reverses the order of columns for RTL
        tableRows.push(itemData);
    });

    doc.autoTable({
        startY: 80,
        head: [isArabic ? reversedColumn : tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [31, 41, 55], font: isArabic ? 'Amiri' : 'helvetica', halign: isArabic ? 'right' : 'left' },
        bodyStyles: { font: isArabic ? 'Amiri' : 'helvetica', halign: isArabic ? 'right' : 'left' },
    });

    // 5. Totals Section
    const finalY = (doc as any).lastAutoTable.finalY || 120;
    doc.setFontSize(10);
    let yPos = finalY + 10;
    
    const totals = [
        { label: terms.subtotal, value: formatCurrency(order.subtotal) },
        ...(order.discount > 0 ? [{ label: terms.discount, value: `-${formatCurrency(order.discount)}` }] : []),
        { label: terms.grandTotal, value: formatCurrency(order.total), isBold: true },
        ...(order.depositAmount > 0 ? [{ label: terms.depositPaid, value: formatCurrency(order.depositAmount) }] : []),
        ...(order.depositAmount > 0 ? [{ label: terms.balanceDue, value: formatCurrency(order.total - order.depositAmount), isBold: true }] : []),
    ];
    
    const labelX = isArabic ? pageW - margin : 140;
    const valueX = isArabic ? margin + 70 : pageW - margin;

    totals.forEach(({label, value, isBold}) => {
        if(isBold) doc.setFont(isArabic ? 'Amiri' : 'helvetica', 'bold');
        rtlText(label, labelX, yPos, isArabic ? {} : {align: 'left'});
        rtlText(value, valueX, yPos, { align: 'right' });
        if(isBold) doc.setFont(isArabic ? 'Amiri' : 'helvetica', 'normal');
        yPos += 7;
    });

    // 6. Footer Notes
    doc.setFontSize(8);
    rtlText(terms.thankYou, isArabic ? pageW - margin : margin, doc.internal.pageSize.height - 10);
    
    // Open in new tab
    doc.output('dataurlnewwindow');
};
