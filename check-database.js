const knex = require('knex');
const knexConfig = require('./backend/knexfile.js');

async function checkDatabase() {
  const db = knex(knexConfig.development);
  
  try {
    console.log('🔍 Verificando estrutura do banco de dados...\n');
    
    // Listar todas as tabelas
    const tables = await db.raw(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name != 'sqlite_sequence'
      ORDER BY name
    `);
    
    console.log(`📋 Tabelas encontradas (${tables.length}):`);
    for (const table of tables) {
      console.log(`   - ${table.name}`);
      
      // Contar registros de tabelas importantes
      if (['tenants', 'domains', 'orders'].includes(table.name)) {
        try {
          const count = await db(table.name).count('* as total').first();
          console.log(`     → ${count.total} registros`);
        } catch (err) {
          console.log(`     → Erro ao contar: ${err.message}`);
        }
      }
    }
    
    console.log();
    
    // Verificar se há dados de tenant
    try {
      const tenants = await db('tenants').select().limit(3);
      console.log(`✅ Tenants encontrados: ${tenants.length}`);
      tenants.forEach(tenant => {
        console.log(`   - ${tenant.name} (${tenant.slug})`);
      });
    } catch (err) {
      console.log(`❌ Erro ao buscar tenants: ${err.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await db.destroy();
  }
}

checkDatabase();