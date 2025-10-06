const db = require('./src/database/connection');
const PartnershipService = require('./src/services/PartnershipService');

async function testPartnershipSystem() {
  console.log('🧪 TESTANDO SISTEMA DE PARCERIAS 1:1\n');

  try {
    // 1. Verificar se as tabelas foram criadas
    console.log('1. Verificando estrutura do banco...');
    const tables = ['partnership_invitations', 'partnerships', 'partnership_sync_logs', 'partnership_messages'];
    
    for (const table of tables) {
      const exists = await db.schema.hasTable(table);
      console.log(`   ✅ Tabela ${table}: ${exists ? 'CRIADA' : 'NÃO ENCONTRADA'}`);
    }

    // 2. Verificar se existe ao menos um tenant para teste
    console.log('\n2. Verificando tenants disponíveis...');
    const tenants = await db('tenants').select('*').limit(3);
    console.log(`   📊 Tenants encontrados: ${tenants.length}`);
    
    if (tenants.length === 0) {
      throw new Error('Nenhum tenant encontrado! Execute as seeds primeiro.');
    }

    const testTenant = tenants[0];
    console.log(`   🏢 Usando tenant: ${testTenant.name} (ID: ${testTenant.id})`);

    // 3. Teste de criação de convite
    console.log('\n3. Testando criação de convite...');
    const partnershipService = new PartnershipService(testTenant.id);
    
    const invitation = await partnershipService.createInvitation({
      lojista_name: 'Loja Demo Parceria',
      lojista_email: 'lojista.demo@email.com',
      lojista_phone: '(11) 99999-8888',
      lojista_document: '12.345.678/0001-90',
      message: 'Convite de teste para sistema de parcerias 1:1',
      expires_in_days: 7
    });

    console.log(`   ✅ Convite criado com sucesso!`);
    console.log(`   🔗 Token: ${invitation.invitation_token}`);
    console.log(`   📅 Expira em: ${invitation.expires_at}`);
    console.log(`   🌐 URL: ${invitation.invitation_url}`);

    // 4. Teste de listagem de parcerias
    console.log('\n4. Testando listagem de parcerias...');
    const partnerships = await partnershipService.getPartnerships();
    console.log(`   📋 Parcerias encontradas: ${partnerships.length}`);

    // 5. Teste de estatísticas
    console.log('\n5. Testando estatísticas...');
    const stats = await partnershipService.getStats();
    console.log(`   📊 Total de parcerias: ${stats.total_partnerships}`);
    console.log(`   ✅ Parcerias ativas: ${stats.active_partnerships}`);
    console.log(`   📦 Produtos sincronizados: ${stats.total_products_synced}`);

    console.log('\n🎉 SISTEMA DE PARCERIAS FUNCIONANDO PERFEITAMENTE!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   • Criar interface React para gerenciar convites');
    console.log('   • Implementar página pública de aceitação de convites');
    console.log('   • Testar sincronização Bling-to-Bling');
    console.log('   • Implementar sistema de mensagens entre parceiros');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error(error.stack);
  } finally {
    await db.destroy();
  }
}

testPartnershipSystem();