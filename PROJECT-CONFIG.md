# 🔧 PROJECT CONFIG - VITRINE DIGITAL SAAS

## 🎯 **DEFINIÇÕES DO PROJETO**

### **Nome do Produto:** 
Vitrine Digital White Label

### **Público-alvo:**
- **Primary:** Fornecedores/Distribuidores (B2B)
- **Secondary:** Lojistas Dropshippers (B2B2C)

### **Proposta de Valor:**
"Transforme seu catálogo em uma vitrine digital profissional com domínio próprio, conecte lojistas automaticamente e aumente suas vendas via dropshipping integrado ao Bling ERP."

---

## 💰 **MODELO DE NEGÓCIO**

### **Revenue Streams:**
1. **Assinatura Fornecedor:** R$ 499-1299/mês
2. **Setup Fee:** R$ 999-2499 por implantação
3. **Assinatura Lojista:** R$ 99/mês
4. **Comissões Bling:** 10% sobre vendas de ERP
5. **Serviços Premium:** Consultoria/customização

### **Pricing Strategy:**
- **Value-based pricing** (domínio próprio = premium)
- **Setup fee alto** (filtrar clientes sérios)
- **Freemium** para lojistas (aquisição)
- **Upsell** para planos enterprise

---

## 🏗️ **ARQUITETURA TÉCNICA**

### **Stack Tecnológica:**
```yaml
Frontend:
  - Framework: React 18+ 
  - Build: Vite
  - Styling: Tailwind CSS
  - State: Zustand/Redux Toolkit
  - Router: React Router v6

Backend:
  - Runtime: Node.js 18+
  - Framework: Express.js → NestJS
  - Language: JavaScript → TypeScript
  - Database: PostgreSQL 14+
  - ORM: Knex.js → Prisma
  - Cache: Redis
  - Queue: Bull/BullMQ

Infrastructure:
  - Proxy: Nginx
  - CDN: Cloudflare
  - SSL: Let's Encrypt
  - Deploy: Docker + VPS
  - Monitor: Grafana + Sentry
  
Integrations:
  - ERP: Bling API v3
  - CRM: Kommo API
  - Payment: Stripe/Iugu
  - Storage: AWS S3/Local
```

### **Multi-tenant Strategy:**
- **Database:** Row-level security (tenant_id)
- **Domains:** Dynamic host mapping
- **Assets:** Isolated per tenant
- **SSL:** Automatic per domain

---

## 🌐 **INFRAESTRUTURA**

### **Domínios:**
- **Engine:** `engine.vitrine360.com.br`
- **Admin:** `admin.vitrine360.com.br`
- **Docs:** `docs.vitrine360.com.br`
- **Status:** `status.vitrine360.com.br`

### **Ambientes:**
```yaml
Development:
  URL: localhost:3000
  Database: vitrine_dev
  
Staging:
  URL: staging.vitrine360.com.br
  Database: vitrine_staging
  
Production:
  URL: engine.vitrine360.com.br
  Database: vitrine_prod
```

### **VPS Specifications:**
- **Provider:** Hetzner/DigitalOcean
- **CPU:** 4 vCPUs
- **RAM:** 8GB
- **Storage:** 160GB SSD
- **Bandwidth:** Unlimited
- **Cost:** ~R$ 150/mês

---

## 🔐 **SEGURANÇA**

### **Authentication:**
- **JWT Tokens** com refresh
- **OAuth2** para integrações
- **2FA** para admin/enterprise
- **RBAC** (roles por tenant)

### **Data Protection:**
- **HTTPS** obrigatório
- **SQL Injection** prevention (ORM)
- **CORS** configurado
- **Rate Limiting** por IP/tenant
- **Backup** automático diário

---

## 📊 **MÉTRICAS E KPIs**

### **Técnicas:**
- **Uptime:** 99.5%+
- **Response Time:** <2s
- **Error Rate:** <1%
- **Concurrent Users:** 1000+

### **Negócio:**
- **MRR:** Monthly Recurring Revenue
- **CAC:** Customer Acquisition Cost  
- **LTV:** Customer Lifetime Value
- **Churn:** Monthly churn rate
- **NPS:** Net Promoter Score

### **Produto:**
- **DAU/MAU:** Daily/Monthly Active Users
- **Feature Adoption:** % users using features
- **Support Tickets:** Volume e resolution time
- **Performance:** Page load metrics

---

## 🎨 **DESIGN SYSTEM**

### **Cores Primárias:**
- **Primary:** #3B82F6 (Blue 500)
- **Secondary:** #10B981 (Green 500) 
- **Accent:** #F59E0B (Yellow 500)
- **Neutral:** #64748B (Slate 500)

### **Typography:**
- **Primary:** Inter (Google Fonts)
- **Monospace:** Fira Code
- **Headings:** 32px/24px/18px/16px
- **Body:** 16px/14px

### **Components:**
- **Buttons:** Primary, Secondary, Ghost
- **Forms:** Input, Select, Checkbox, Radio
- **Cards:** Default, Hover, Selected
- **Navigation:** Sidebar, Topbar, Breadcrumbs

---

## 🔌 **INTEGRAÇÕES**

### **Bling ERP API:**
```yaml
Version: v3
Auth: OAuth2 + JWT
Endpoints:
  - /produtos (GET, POST, PUT)
  - /pedidos (GET, POST)
  - /contatos (GET, POST)
  - /estoques (GET)
Rate Limit: 100 req/min
Webhook: /api/bling/webhook
```

### **Kommo CRM API:**
```yaml
Version: v4  
Auth: OAuth2
Endpoints:
  - /leads (GET, POST, PUT)
  - /contacts (GET, POST)
  - /companies (GET, POST)
Pipeline: Custom dropshipping flow
```

### **Payment Gateway:**
```yaml
Primary: Stripe
Secondary: Iugu (Brazil)
Features:
  - Subscriptions
  - Webhooks  
  - Invoicing
  - Multi-currency (BRL)
```

---

## 📱 **FEATURES ROADMAP**

### **MVP (8 weeks):**
- ✅ Multi-tenant architecture
- ✅ Domain white label
- ✅ Bling integration
- ✅ Basic billing
- ✅ Admin dashboard

### **V2 (3 months):**
- 📱 Mobile app
- 🤖 Kommo integration  
- 📊 Advanced analytics
- 🛒 Marketplace features
- 🔔 Push notifications

### **V3 (6 months):**
- 🤖 AI product recommendations
- 📈 Automated pricing rules
- 🌍 Multi-language support
- 📦 Logistics integration
- 🔗 External APIs

---

## 🏷️ **BRANDING**

### **Logo Requirements:**
- **Format:** SVG + PNG
- **Variants:** Full, Icon, Monogram  
- **Colors:** Full color, Monochrome
- **Sizes:** 16px to 512px

### **White Label Assets:**
- **Logo:** Customer uploadable
- **Favicon:** Auto-generated from logo
- **Colors:** Custom CSS variables
- **Fonts:** Web fonts support
- **Meta Tags:** SEO customizable

---

## 📞 **CONTATOS ESTRATÉGICOS**

### **Fornecedores Beta:**
1. **[Nome Fornecedor 1]**
   - Contato: [Email/Telefone]
   - Segmento: [Ex: Cosméticos]
   - Status: Interessado

2. **[Nome Fornecedor 2]**
   - Contato: [Email/Telefone]  
   - Segmento: [Ex: Eletrônicos]
   - Status: Aguardando demo

### **Parceiros Técnicos:**
- **Bling:** Parceiro consultor (10% comissão)
- **Kommo:** Integração pendente
- **[Outros]:** Lista de integradores

---

## 🚨 **CONTINGÊNCIAS**

### **Plan B Options:**
1. **Domínio próprio complexo?** → Subdomínio premium
2. **Cloudflare caro?** → Nginx + Let's Encrypt manual  
3. **Multi-tenant complexo?** → Single-tenant MVP
4. **Bling instável?** → API própria + sync posterior

### **Emergency Contacts:**
- **Servidor down:** [Provedor suporte]
- **DNS issues:** [Cloudflare suporte]
- **Payment issues:** [Stripe/Iugu suporte]

---

## 📅 **DATAS IMPORTANTES**

- **Project Start:** 06/10/2025
- **MVP Target:** 01/12/2025 (8 weeks)
- **Beta Launch:** 15/12/2025
- **Commercial Launch:** 01/01/2026
- **Series A Target:** Q2 2026

---

## 🎯 **SUCCESS CRITERIA**

### **Technical Success:**
- [ ] 99%+ uptime in production
- [ ] <2s load time all pages  
- [ ] Zero security incidents
- [ ] Automated deployments working

### **Business Success:**
- [ ] 3+ paying customers
- [ ] R$ 3k+ MRR
- [ ] <10% monthly churn
- [ ] 70+ NPS score

### **Product Success:**
- [ ] 20+ domains active
- [ ] 1000+ products synced
- [ ] 100+ orders processed
- [ ] 5-star reviews

---

**📝 Document Version:** 1.0  
**📅 Last Updated:** 06/10/2025  
**👨‍💻 Owner:** HUB360PLUS  
**📊 Status:** Active Development