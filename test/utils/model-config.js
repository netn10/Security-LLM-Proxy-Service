const fs = require('fs');
const path = require('path');

/**
 * Load model configuration from config/models.json
 */
function loadModelConfig() {
  try {
    const configPath = path.join(__dirname, '../../config/models.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Error loading model configuration:', error.message);
    // Fallback to default models if config file is not available
    return {
      openai: {
        default: 'gpt-3.5-turbo',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo']
      },
                    anthropic: {
         default: 'claude-3-5-sonnet-20241022',
         models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
      },
      google: {
        default: 'gemini-1.5-flash',
        models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
      }
    };
  }
}

/**
 * Get default model for a provider
 * @param {string} provider - The provider name (openai, anthropic, google)
 * @returns {string} The default model name
 */
function getDefaultModel(provider) {
  const config = loadModelConfig();
  return config[provider]?.default || 'gpt-3.5-turbo';
}

/**
 * Get all available models for a provider
 * @param {string} provider - The provider name (openai, anthropic, google)
 * @returns {string[]} Array of available model names
 */
function getAvailableModels(provider) {
  const config = loadModelConfig();
  return config[provider]?.models || [];
}

/**
 * Get a random model for a provider (useful for testing)
 * @param {string} provider - The provider name (openai, anthropic, google)
 * @returns {string} A random model name from the available models
 */
function getRandomModel(provider) {
  const models = getAvailableModels(provider);
  if (models.length === 0) {
    return getDefaultModel(provider);
  }
  return models[Math.floor(Math.random() * models.length)];
}

/**
 * Validate if a model is available for a provider
 * @param {string} provider - The provider name (openai, anthropic, google)
 * @param {string} model - The model name to validate
 * @returns {boolean} True if the model is available
 */
function isValidModel(provider, model) {
  const models = getAvailableModels(provider);
  return models.includes(model);
}

module.exports = {
  loadModelConfig,
  getDefaultModel,
  getAvailableModels,
  getRandomModel,
  isValidModel
};
