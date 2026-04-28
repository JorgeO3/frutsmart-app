/**
 * Complete End-to-End Test Script for FrutSmart Backend
 * 
 * Tests all endpoints including:
 * - Health checks
 * - Upload flow with real blob storage
 * - Evaluation creation
 * 
 * Prerequisites:
 * 1. Backend running (npm run start:dev)
 * 2. Docker services running (docker-compose up)
 * 3. Place a real .webp image at the path specified in IMAGE_FILE_PATH
 * 
 * Usage:
 *   node scripts/test-all-endpoints.js
 */

import { create, put, get } from 'axios';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

// 🔧 TODO: Replace this path with your actual .webp image file
const IMAGE_FILE_PATH = '/home/jorge/Documents/projects/frutsmart-back/scripts/sample_image.webp';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = process.env.API_PREFIX || 'api/v1';
const API_KEY = process.env.INTERNAL_API_SECRET || 'c0d29aceed17f3ae05be3f73e24174755ae1ae585600d30b93414c9e4f7934e1';
const API_KEY_HEADER = process.env.API_KEY_HEADER || 'x-internal-secret';

const API_BASE = `${BASE_URL}/${API_PREFIX}`;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate UUID v4
 */
function generateUUID() {
  return randomUUID();
}

/**
 * Calculate MD5 hash of a file
 */
function calculateMD5(filePath) {
  const fileBuffer = readFileSync(filePath);
  return createHash('md5').update(fileBuffer).digest('hex');
}

/**
 * Get file stats
 */
function getFileInfo(filePath) {
  const stats = statSync(filePath);
  const fileName = basename(filePath);
  return {
    fileName,
    fileSizeBytes: stats.size,
    md5: calculateMD5(filePath),
    contentType: 'image/webp',
  };
}

/**
 * HTTP client with API key
 */
const httpClient = create({
  baseURL: API_BASE,
  headers: {
    [API_KEY_HEADER]: API_KEY,
    'Content-Type': 'application/json',
  },
});

/**
 * Upload file to Azure Blob Storage using SAS URL
 */
async function uploadToBlobStorage(sasUrl, filePath, contentType) {
  const fileBuffer = readFileSync(filePath);
  
  const response = await put(sasUrl, fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'x-ms-blob-type': 'BlockBlob',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return response;
}

/**
 * Logger with colors
 */
const log = {
  info: (msg) => console.log(`\n📘 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  data: (data) => console.log(JSON.stringify(data, null, 2)),
  separator: () => console.log(`\n${'='.repeat(80)}\n`),
};

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test 1: Health Check Endpoints
 */
async function testHealthEndpoints() {
  log.separator();
  log.info('TEST 1: Health Check Endpoints');
  
  try {
    // Test /health
    log.info('Testing GET /health');
    const healthResponse = await get(`${BASE_URL}/health`);
    log.success(`Status: ${healthResponse.status}`);
    log.data(healthResponse.data);

    // Test /health/ready
    log.info('Testing GET /health/ready');
    const readyResponse = await get(`${BASE_URL}/health/ready`);
    log.success(`Status: ${readyResponse.status}`);
    log.data(readyResponse.data);

    // Test /health/live
    log.info('Testing GET /health/live');
    const liveResponse = await get(`${BASE_URL}/health/live`);
    log.success(`Status: ${liveResponse.status}`);
    log.data(liveResponse.data);

    log.success('✓ All health endpoints passed');
    return true;
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    if (error.response) {
      log.data(error.response.data);
    }
    return false;
  }
}

/**
 * Test 2: Complete Upload Flow
 * 1. Create upload session
 * 2. Get SAS tokens
 * 3. Upload file to blob storage
 * 4. Complete session
 */
async function testUploadFlow() {
  log.separator();
  log.info('TEST 2: Complete Upload Flow');

  // Validate image file exists
  if (!existsSync(IMAGE_FILE_PATH)) {
    log.error(`Image file not found: ${IMAGE_FILE_PATH}`);
    log.error('Please update IMAGE_FILE_PATH in the script with a valid .webp image path');
    return null;
  }

  const fileInfo = getFileInfo(IMAGE_FILE_PATH);
  log.info(`Using image: ${fileInfo.fileName} (${fileInfo.fileSizeBytes} bytes)`);

  try {
    // Step 1: Create upload session
    log.info('Step 1: Creating upload session');
    const clientItemId = generateUUID();
    const sessionPayload = {
      domain: 'plant',
      clientId: generateUUID(),
      userName: 'test-user',
      files: [
        {
          clientItemId,
          fileName: fileInfo.fileName,
          fileSizeBytes: fileInfo.fileSizeBytes,
          contentType: fileInfo.contentType,
          md5: fileInfo.md5,
        },
      ],
    };

    log.data(sessionPayload);
    const sessionResponse = await httpClient.post('/upload/sessions', sessionPayload);
    log.success(`Session created with ID: ${sessionResponse.data.sessionId}`);
    log.data(sessionResponse.data);

    const sessionId = sessionResponse.data.sessionId;
    const blobPath = sessionResponse.data.files[0].blobPath;

    // Step 2: Get SAS tokens
    log.info('Step 2: Getting SAS tokens');
    const sasPayload = {
      clientItemIds: [clientItemId],
    };

    const sasResponse = await httpClient.post(
      `/upload/sessions/${sessionId}/sas-batch`,
      sasPayload
    );
    log.success('SAS tokens generated');
    log.data(sasResponse.data);

    const sasUrl = sasResponse.data.sasUrls[0].sasUrl;

    // Step 3: Upload file to blob storage
    log.info('Step 3: Uploading file to Azure Blob Storage');
    await uploadToBlobStorage(sasUrl, IMAGE_FILE_PATH, fileInfo.contentType);
    log.success('File uploaded successfully to blob storage');

    // Step 4: Complete session
    log.info('Step 4: Completing upload session');
    const completePayload = {
      uploadedItems: [
        {
          clientItemId,
          status: 'uploaded',
        },
      ],
    };

    const completeResponse = await httpClient.post(
      `/upload/sessions/${sessionId}/complete`,
      completePayload
    );
    log.success('Session completed successfully');
    log.data(completeResponse.data);

    log.success('✓ Upload flow completed successfully');
    
    return {
      sessionId,
      clientItemId,
      blobPath,
      fileName: fileInfo.fileName,
    };
  } catch (error) {
    log.error(`Upload flow failed: ${error.message}`);
    if (error.response) {
      log.error(`Status: ${error.response.status}`);
      log.data(error.response.data);
    }
    return null;
  }
}

/**
 * Test 3: Refresh SAS Tokens (optional feature test)
 * Uncomment to test SAS token refresh endpoint
 */
// async function testRefreshSasTokens(sessionId, clientItemId) {
//   log.separator();
//   log.info('TEST 3: Refresh SAS Tokens (Optional)');
//
//   try {
//     // Note: This will likely fail if session is already completed
//     // but demonstrates the endpoint functionality
//     const refreshPayload = {
//       clientItemIds: [clientItemId],
//     };
//
//     const refreshResponse = await httpClient.post(
//       `/upload/sessions/${sessionId}/sas/refresh`,
//       refreshPayload
//     );
//     log.success('SAS tokens refreshed');
//     log.data(refreshResponse.data);
//     return true;
//   } catch (error) {
//     log.error(`Refresh SAS failed (expected if session completed): ${error.message}`);
//     if (error.response) {
//       log.data(error.response.data);
//     }
//     return false;
//   }
// }

/**
 * Test 4: Create Evaluation
 */
async function testCreateEvaluation(uploadData) {
  log.separator();
  log.info('TEST 4: Create Complete Evaluation');

  if (!uploadData) {
    log.error('Skipping evaluation test (no upload data available)');
    return false;
  }

  try {
    const evaluationId = generateUUID();
    const resultId = generateUUID();
    const stepId = generateUUID();
    const photoId = generateUUID();
    const segmentId = generateUUID();

    const evaluationPayload = {
      evaluationId,
      plantId: generateUUID(),
      evaluatorUserId: generateUUID(),
      createdAt: new Date().toISOString(),
      isFinalized: true,
      
      results: [
        {
          id: resultId,
          aiClassName: 'healthy',
          aiConfidence: 0.95,
          aiRawConfidencesJson: {
            healthy: 0.95,
            diseased: 0.05,
          },
          hfIsCorrect: true,
        },
      ],

      steps: [
        {
          id: stepId,
          resultId,
          methodName: 'cnn-classifier',
          modelVersion: 'v1.0.0',
          processingTimeMs: 150,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: 'completed',
        },
      ],

      photos: [
        {
          id: photoId,
          role: 'raw',
          blobContainerName: 'plant',
          blobPath: uploadData.blobPath,
          blobFileName: uploadData.fileName,
          fileSizeBytes: 1024000,
          contentType: 'image/webp',
          capturedAt: new Date().toISOString(),
        },
      ],

      segments: [
        {
          id: segmentId,
          photoId,
          resultId,
          segmentType: 'leaf',
          boundingBox: {
            x: 100,
            y: 100,
            width: 200,
            height: 200,
          },
          confidence: 0.98,
        },
      ],
    };

    log.data(evaluationPayload);
    const evaluationResponse = await httpClient.post('/evaluations', evaluationPayload);
    log.success(`Evaluation created with ID: ${evaluationResponse.data.id}`);
    log.data(evaluationResponse.data);

    log.success('✓ Evaluation created successfully');
    return true;
  } catch (error) {
    log.error(`Evaluation creation failed: ${error.message}`);
    if (error.response) {
      log.error(`Status: ${error.response.status}`);
      log.data(error.response.data);
    }
    return false;
  }
}

/**
 * Test 5: Error Handling - Invalid Requests
 */
async function testErrorHandling() {
  log.separator();
  log.info('TEST 5: Error Handling - Invalid Requests');

  try {
    // Test invalid session creation (missing required fields)
    log.info('Testing validation errors...');
    try {
      await httpClient.post('/upload/sessions', {
        domain: 'invalid-domain',
        files: [],
      });
      log.error('Should have failed with validation error');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log.success('✓ Validation error handled correctly');
        log.data(error.response.data);
      } else {
        throw error;
      }
    }

    // Test unauthorized access (no API key)
    log.info('Testing unauthorized access...');
    try {
      await get(`${API_BASE}/upload/sessions`);
      log.error('Should have failed with unauthorized error');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        log.success('✓ Unauthorized error handled correctly');
        log.data(error.response.data);
      } else {
        throw error;
      }
    }

    // Test not found (invalid session ID)
    log.info('Testing not found errors...');
    try {
      await httpClient.post(
        `/upload/sessions/${generateUUID()}/complete`,
        { uploadedItems: [] }
      );
      log.error('Should have failed with not found error');
    } catch (error) {
      if (error.response && (error.response.status === 404 || error.response.status === 400)) {
        log.success('✓ Not found error handled correctly');
        log.data(error.response.data);
      } else {
        throw error;
      }
    }

    log.success('✓ Error handling tests completed');
    return true;
  } catch (error) {
    log.error(`Error handling test failed: ${error.message}`);
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   FrutSmart Backend - Complete E2E Tests                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log(`🔗 API Base URL: ${API_BASE}`);
  console.log(`🔑 Using API Key: ${API_KEY.substring(0, 10)}...`);
  console.log(`📁 Image Path: ${IMAGE_FILE_PATH}`);
  console.log('\n');

  const results = {
    health: false,
    upload: false,
    evaluation: false,
    errorHandling: false,
  };

  let uploadData = null;

  // Run tests
  results.health = await testHealthEndpoints();
  uploadData = await testUploadFlow();
  results.upload = uploadData !== null;
  
  if (uploadData) {
    // Optional: Test refresh tokens (will likely fail if session completed)
    // await testRefreshSasTokens(uploadData.sessionId, uploadData.clientItemId);
    
    results.evaluation = await testCreateEvaluation(uploadData);
  }
  
  results.errorHandling = await testErrorHandling();

  // Summary
  log.separator();
  log.info('TEST SUMMARY');
  console.log('\n');
  console.log(`Health Endpoints:     ${results.health ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Upload Flow:          ${results.upload ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Evaluation Creation:  ${results.evaluation ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Error Handling:       ${results.errorHandling ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('\n');

  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! 🎉');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

// Check if running as main module
if (require.main === module) {
  runAllTests().catch((error) => {
    log.error(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

export default {
  testHealthEndpoints,
  testUploadFlow,
  testCreateEvaluation,
  testErrorHandling,
  runAllTests,
};
