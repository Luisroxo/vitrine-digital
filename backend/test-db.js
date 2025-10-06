const db = require('./src/database/connection');

async function test() {
  try {
    const tables = await db.raw("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tabelas:', tables.map(t => t.name));
    
    if (tables.find(t => t.name === 'tenants')) {
      const tenantCount = await db('tenants').count('* as total').first();
      console.log('Tenants:', tenantCount.total);
    }
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    db.destroy();
  }
}

test();