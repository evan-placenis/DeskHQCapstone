import { supabaseAdmin } from '../infrastructure/supabase/supabaseClient'; 
import { SupabaseProjectRepository } from '../infrastructure/repositories/supabase_repository/SupbaseProjectRepository'; 
import { TriggerJobQueue } from '../infrastructure/job/trigger/TriggerJobQueue'; // 👈 NEW
import { Project } from '../domain/core/project.types'; 
import { v4 as uuidv4 } from 'uuid'; 
import dotenv from 'dotenv';
import path from 'path';

// Load Env for the script
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

async function runTest() {
    console.log("🚀 Starting Full Integration Test (DB + Queue)...\n");

    let newUserId = '';
    let newOrgId = '';
    let projectId = uuidv4();

    try {
        // ====================================================
        // STEP 1: SETUP DATABASE (User + Org)
        // ====================================================
        console.log("1️⃣  Setting up Database Prerequisites...");
        
        // A. Create User
        const testEmail = `test-runner-${Date.now()}@example.com`;
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: testEmail,
            password: 'TestPassword123!',
            email_confirm: true
        });
        if (authError) throw authError;
        newUserId = authData.user.id;
        console.log(`${GREEN}✔ Created Test User${RESET}`);

        // B. Create Organization
        const { data: orgData, error: orgError } = await supabaseAdmin
            .from('organizations') 
            .insert({ name: "Integration Test Org" })
            .select()
            .single();

        if (orgError) throw new Error(`Failed to create Org: ${orgError.message}`);
        newOrgId = orgData.id;
        console.log(`${GREEN}✔ Created Test Org${RESET}`);

        // ====================================================
    // STEP 2: CREATE PROJECT WITH AN IMAGE
    // ====================================================
    console.log("\n2️⃣  Creating Project...");

    const projectRepo = new SupabaseProjectRepository(supabaseAdmin);
    
    // 1. Generate an Image ID
    const testImageId = uuidv4(); 

    const mockProject: Project = {
        projectId: projectId,
        organizationId: newOrgId,
        name: "Trigger.dev Integration Project",
        status: "ACTIVE", 
        metadata: {
            createdDate: new Date(),
            lastModifiedDate: new Date(),
            createdByUserId: newUserId,
            status: "ACTIVE"
        },
        jobInfo: { clientName: "Test Client",
                siteAddress: "123 Test Lane",
                parsedData: { 
                    note: "This project exists in DB!" 
                } },
        
        // 2. 🟢 ADD A DUMMY IMAGE HERE
        images: [
            {
                url: "https://via.placeholder.com/150", // Fake URL
                caption: "Test Image",
                analysis: "This is a test image analysis" // Mock AI analysis
            }
        ],
        knowledgeItems: []
    };

    await projectRepo.save(mockProject);
    console.log(`${GREEN}✔ Project Saved to DB (ID: ${projectId})${RESET}`);

    // ====================================================
    // STEP 3: FIRE THE QUEUE
    // ====================================================
    console.log(`\n${BLUE}3️⃣  Firing Trigger.dev Event...${RESET}`);

    const jobQueue = new TriggerJobQueue();

    await jobQueue.enqueueReportGeneration(
        projectId,
        newUserId,
        {
            reportType: "OBSERVATION",
            modelName: "GROK",
            modeName: "TEXT_ONLY", 
            // 3. 🟢 PASS THE VALID ID HERE
            selectedImageIds: [testImageId], 
            templateId: "template-default"
        }
    );

        console.log(`${GREEN}✔ Job Enqueued Successfully!${RESET}`);
        console.log("👀 CHECK TERMINAL 1 (The Worker) - It should be processing this now.");
        
        // Optional: Wait 5 seconds so you can see the logs before cleanup deletes the data
        console.log("⏳ Waiting 5 seconds to ensure Worker can fetch data...");
        await new Promise(r => setTimeout(r, 5000));

    } catch (err: any) {
        console.error(`${RED}❌ FAILED:${RESET}`, err.message);
    } finally {
        // ====================================================
        // STEP 4: CLEANUP
        // ====================================================
        // console.log("\n🧹 Cleaning up test data...");
        
        // // 1. Delete Project (Manual delete to be safe, though Org cascade might handle it)
        // if (projectId) {
        //      await supabaseAdmin.from('projects').delete().eq('project_id', projectId);
        // }
        
        // // 2. Delete Org 
        // if (newOrgId) {
        //     await supabaseAdmin.from('organizations').delete().eq('id', newOrgId);
        // }

        // // 3. Delete User
        // if (newUserId) {
        //     await supabaseAdmin.auth.admin.deleteUser(newUserId);
        // }
        // console.log("✔ Cleanup Finished.");
    }
}

runTest();