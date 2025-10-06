const db = require('./src/database/connection');

async function clearPartnershipData() {
  try {
    console.log('🧹 Limpando dados de parcerias antigas...');
    
    await db('partnership_messages').del();
    console.log('   ✅ Mensagens removidas');
    
    await db('partnership_sync_logs').del();
    console.log('   ✅ Logs de sincronização removidos');
    
    await db('partnerships').del();
    console.log('   ✅ Parcerias removidas');
    
    await db('partnership_invitations').del();
    console.log('   ✅ Convites removidos');
    
    console.log('\n🎉 Dados limpos com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao limpar dados:', error);
  } finally {
    await db.destroy();
  }
}

clearPartnershipData();