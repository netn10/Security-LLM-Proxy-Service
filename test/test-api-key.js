const axios = require('axios');
const { getDefaultModel } = require('./utils/model-config');

require('dotenv').config({ path: '.env' });

async function testOpenAI() {
  console.log('🔑 Testing OpenAI API Key...\n');
  
  console.log('📋 OpenAI Environment Configuration:');
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   OPENAI_API_URL: ${process.env.OPENAI_API_URL || 'https://api.openai.com'}`);
  console.log('');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not set in environment');
    return false;
  }
  
  try {
    console.log('🧪 Making test API call to OpenAI...');
    
    const response = await axios.post(
      `${process.env.OPENAI_API_URL || 'https://api.openai.com'}/v1/chat/completions`,
      {
        model: getDefaultModel('openai'),
        messages: [
          {
            role: 'user',
            content: 'Say "Hello World"',
          },
        ],
        max_tokens: 10,
        temperature: 0,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ OpenAI API call successful!');
    console.log(`   Response: ${response.data.choices[0]?.message?.content}`);
    return true;
    
  } catch (error) {
    console.log('❌ OpenAI API call failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error?.message || error.response.data}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function testAnthropic() {
  console.log('🤖 Testing Anthropic API Key...\n');
  
  console.log('📋 Anthropic Environment Configuration:');
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`   ANTHROPIC_API_URL: ${process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com'}`);
  console.log('');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY not set in environment');
    return false;
  }
  
  try {
    console.log('🧪 Making test API call to Anthropic...');
    
    const response = await axios.post(
      `${process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com'}/v1/messages`,
      {
        model: getDefaultModel('anthropic'),
        messages: [
          {
            role: 'user',
            content: 'Say "Hello World"',
          },
        ],
        max_tokens: 10,
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
      }
    );
    
    console.log('✅ Anthropic API call successful!');
    console.log(`   Response: ${response.data.content[0]?.text}`);
    return true;
    
  } catch (error) {
    console.log('❌ Anthropic API call failed:');
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error?.message || error.response.data}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
    return false;
  }
}

async function testApiKeys() {
  console.log('🚀 Starting API Key Tests...\n');
  
  const openaiResult = await testOpenAI();
  const anthropicResult = await testAnthropic();
  
  console.log('\n📊 Test Summary:');
  console.log(`   OpenAI: ${openaiResult ? '✅ Working' : '❌ Failed'}`);
  console.log(`   Anthropic: ${anthropicResult ? '✅ Working' : '❌ Failed'}`);
  
  if (openaiResult && anthropicResult) {
    console.log('\n🎉 All API keys are working correctly!');
  } else if (openaiResult || anthropicResult) {
    console.log('\n⚠️  Some API keys are working, but others failed.');
  } else {
    console.log('\n❌ No API keys are working. Please check your configuration.');
  }
}

testApiKeys().catch(console.error);
