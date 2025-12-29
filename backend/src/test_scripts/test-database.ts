import { supabaseAdmin } from '../infrastructure/supabase/supabaseClient'; 
import { SupabaseProjectRepository } from '../infrastructure/repositories/supabase_repository/SupbaseProjectRepository'; 
import { Project } from '../domain/core/project.types'; 
import { v4 as uuidv4 } from 'uuid'; 

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function runTest() {
    console.log("🚀 Starting Backend Connection Test...\n");

    let newUserId = '';
    let newOrgId = '';

    try {
        // ====================================================
        // TEST 1: ADMIN CONNECTION (Create a Fake User)
        // ====================================================
        console.log("1️⃣  Testing Admin Auth Connection...");
        
        const testEmail = `test-user-${Date.now()}@example.com`;
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: testEmail,
            password: 'TestPassword123!',
            email_confirm: true
        });

        if (authError) throw authError;
        newUserId = authData.user.id;
        console.log(`${GREEN}✔ SUCCESS:${RESET} Created Admin User ID: ${newUserId}`);

        // ====================================================
        // TEST 1.5: CREATE DUMMY ORGANIZATION (Fixes Foreign Key Error)
        // ====================================================
        console.log("\n1️⃣.5️⃣  Creating Dummy Organization...");
        
        // ⚠️ VERIFY: Is your table named 'organizations'? 
        const { data: orgData, error: orgError } = await supabaseAdmin
            .from('organizations') 
            .insert({
                name: "Test Runner Org",
                // owner_id: newUserId // UNCOMMENT if your orgs require an owner
            })
            .select()
            .single();

        if (orgError) throw new Error(`Failed to create Org: ${orgError.message}`);
        
        newOrgId = orgData.id;
        console.log(`${GREEN}✔ SUCCESS:${RESET} Created Org ID: ${newOrgId}`);

        // ====================================================
        // TEST 2: REPOSITORY LOGIC (Save & Fetch Project)
        // ====================================================
        console.log("\n2️⃣  Testing Project Repository...");

        const projectRepo = new SupabaseProjectRepository(supabaseAdmin);
        const projectId = uuidv4();

        const mockProject: Project = {
            projectId: projectId,
            organizationId: newOrgId, // 🟢 NOW USING REAL ORG ID
            name: "Test Backend Project",
            status: "ACTIVE", 
            metadata: {
                createdDate: new Date(),
                lastModifiedDate: new Date(),
                createdByUserId: newUserId,
                status: "ACTIVE"
            },
            jobInfo: {
                clientName: "Acme Corp Test",
                siteAddress: "123 Test Lane",
                parsedData: { note: "JSON payload" }
            },
            images: [],
            knowledgeItems: []
        };

        // A. SAVE
        console.log("   Attempting to SAVE project...");
        await projectRepo.save(mockProject);
        console.log(`${GREEN}✔ Project Saved.${RESET}`);

        // B. FETCH
        console.log("   Attempting to FETCH project...");
        const retrievedProject = await projectRepo.getById(projectId);

        if (!retrievedProject) throw new Error("Project returned null!");
        
        if (retrievedProject.name === mockProject.name) {
            console.log(`${GREEN}✔ SUCCESS:${RESET} Retrieved project matches sent data.`);
        } else {
            throw new Error("Retrieved data mismatch.");
        }

    } catch (err: any) {
        console.error(`${RED}❌ FAILED:${RESET}`, err.message);
    } finally {
        // ====================================================
        // CLEANUP
        // ====================================================
        console.log("\n🧹 Cleaning up test data...");
        
        // Delete Org (Projects usually cascade delete)
        if (newOrgId) {
            await supabaseAdmin.from('organizations').delete().eq('id', newOrgId);
        }
        // Delete User
        if (newUserId) {
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
        }
        console.log("✔ Cleanup Finished.");
    }
}

runTest();