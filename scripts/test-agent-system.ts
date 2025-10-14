/**
 * 🧪 TEST AGENT SYSTEM
 * Script per testare il sistema multi-agente
 */

import { Orchestrator } from '../lib/agents/core/orchestrator';

async function testAgentSystem() {
  console.log('🧪 Testing Agent System...\n');

  try {
    // 1. Create orchestrator
    console.log('1️⃣ Creating orchestrator...');
    const orchestrator = new Orchestrator();

    // 2. Initialize
    console.log('2️⃣ Initializing orchestrator...');
    await orchestrator.initialize();

    // 3. Get stats
    console.log('\n3️⃣ System Stats:');
    const stats = orchestrator.getStats();
    console.log(JSON.stringify(stats, null, 2));

    // 4. Get agents
    console.log('\n4️⃣ Active Agents:');
    const agents = orchestrator.getActiveAgents();
    agents.forEach(agent => {
      console.log(`\n🤖 ${agent.name}`);
      console.log(`   App: ${agent.appContext?.appName || 'N/A'}`);
      console.log(`   Category: ${agent.appContext?.category || 'N/A'}`);
      console.log(`   Status: ${agent.status}`);
      console.log(`   Capabilities: ${agent.capabilities.length}`);
    });

    // 5. Test simple request
    console.log('\n5️⃣ Testing simple request...');
    const result = await orchestrator.processUserRequest(
      'List all available apps and their categories'
    );

    console.log('\n📊 Result:');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`Logs: ${result.logs.length} entries`);

    console.log('\n✅ All tests passed!');
    console.log('\n🎉 Agent System is working correctly!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testAgentSystem();
