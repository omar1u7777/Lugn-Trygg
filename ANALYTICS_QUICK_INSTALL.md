# 🚀 ANALYTICS UPGRADE - SNABBINSTALLATION

## 📋 Kör dessa kommandon:

### 1. Installera Dependencies
```powershell
cd web-app
npm install jspdf recharts
```

### 2. Verifiera Installation
```powershell
npm list jspdf recharts
```

**Förväntat output:**
```
├── jspdf@2.5.2
└── recharts@2.15.0
```

### 3. Starta Dev Server (Valfritt)
```powershell
npm run dev
```

### 4. Testa Features

#### Dashboard Widget
1. Navigera till `/dashboard`
2. Scrolla ner - se **Analytics Widget** efter Feedback-widgeten
3. Verifiera: Mood score, 7-dagars prognos, trend-emoji, gradient-färg
4. Klicka på widget → navigerar till `/analytics`

#### Visual Charts
1. Gå till `/analytics`
2. Verifiera 3 diagram:
   - **AreaChart**: Prognos med blå gradient
   - **BarChart**: Dagliga prediktioner (lila staplar)
   - **LineChart**: Historisk data (grön linje)

#### PDF Export
1. På `/analytics` - klicka "Exportera PDF" knapp
2. Verifiera PDF laddar ner: `Lugn-Trygg-Analys-YYYY-MM-DD.pdf`
3. Öppna PDF - kontrollera alla sektioner finns:
   - Nuvarande analys
   - Dagliga prediktioner
   - Riskfaktorer
   - Rekommendationer
   - AI-modell info

#### Email Alert (Backend)
```powershell
# Test via API
curl -X GET http://localhost:5001/api/mood/predictive-forecast `
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Om trend = declining ELLER risk = high:**
- Kolla email (SendGrid)
- Verifiera HTML template med forecast data

#### Forecast Accuracy
```powershell
# Test via API
curl -X GET http://localhost:5001/api/mood/forecast-accuracy `
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "accuracy_score": 87.3,
  "total_forecasts": 15,
  "valid_comparisons": 42,
  "average_error": 1.3,
  "comparisons": [...]
}
```

---

## 🐛 Troubleshooting

### Problem: "Cannot find module 'recharts'"
**Lösning:**
```powershell
cd web-app
npm install recharts --save
```

### Problem: "Cannot find module 'jspdf'"
**Lösning:**
```powershell
cd web-app
npm install jspdf --save
```

### Problem: PDF innehåller �� istället för å, ä, ö
**Lösning:** jsPDF v2.5.2 stödjer UTF-8 automatiskt. Om problem kvarstår:
```typescript
// Add to exportToPDF()
doc.setFont("helvetica");
```

### Problem: Email skickas inte
**Kontrollera:**
1. `SENDGRID_API_KEY` satt i `.env`
2. SendGrid account aktiv
3. Email verifierad i SendGrid
4. Backend logs: `📧 Analytics alert email sent: False`

### Problem: Recharts inte responsiva
**Kontrollera:**
```tsx
// AnalyticsCharts.tsx ska ha:
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={...}>
```

---

## ✅ Verifikation Checklist

- [ ] `npm list jspdf recharts` visar 2.5.2 och 2.15.0
- [ ] Dashboard Widget syns och laddar data
- [ ] Analytics-sidan visar 3 diagram
- [ ] Export PDF-knapp fungerar
- [ ] PDF innehåller alla 6 sektioner
- [ ] Email skickas vid declining trend (kontrollera logs)
- [ ] `/forecast-accuracy` endpoint returnerar data
- [ ] Inga TypeScript-errors (utom Grid warnings - ignoreras)

---

## 🎯 Nästa Steg

1. **Kör `npm install`** i web-app directory
2. **Testa alla features** enligt checklistan ovan
3. **Deploy till Vercel** (frontend auto-deploys från git push)
4. **Test i produktion** på lugn-trygg.vercel.app

---

**Installationen tar ~2 minuter!**

**Status:** REDO FÖR PRODUKTION ✅
