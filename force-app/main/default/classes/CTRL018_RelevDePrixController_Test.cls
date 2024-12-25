@isTest
public class CTRL018_RelevDePrixController_Test {

    @testSetup
static void setup() {
    // Create a test user
    Profile testProfile = [SELECT Id FROM Profile WHERE Name = 'Agence Agadir' LIMIT 1];
    User testUser = new User(
        Alias = 'testuser',
        Email = 'testuser@example.com',
        EmailEncodingKey = 'UTF-8',
        LastName = 'User',
        LanguageLocaleKey = 'en_US',
        LocaleSidKey = 'en_US',
        ProfileId = testProfile.Id,
        TimeZoneSidKey = 'America/Los_Angeles',
        Username = 'newtestuser@example.com',
        Agence_commerciale__c = 'A02'
    );
    insert testUser;

    // Create test records for Relev_de_prix__c
    insert new Relev_de_prix__c(
        Name = 'MARRAKECH-Traditionnel-D\u00e9taillant-Pain',
        Agence__c = 'A02',
        Circuit_de_client__c = 'Traditionnel',
        Type_de_client__c = 'Gros',
        Type_de_produit__c = 'Pain',
        Prix__c = 100
    );

    insert new Relev_de_prix__c(
        Name = 'MARRAKECH-Traditionnel-Administration-Pain',
        Agence__c = 'A02',
        Circuit_de_client__c = 'Traditionnel',
        Type_de_client__c = 'Administration',
        Type_de_produit__c = 'Pain',
        Prix__c = 150
    );
}


    @isTest
    static void testGetUserRegion() {
        Test.startTest();
        String region = CTRL018_RelevDePrixController.getUserRegion();
        Test.stopTest();

        System.assertNotEquals(null, region, 'User region should not be null');
    }

    @isTest
    static void testGetMatrixData() {
        Test.startTest();
        Map<String, Object> result = CTRL018_RelevDePrixController.getMatrixData(2024,'12','Traditionnel', 'Region1');
        Test.stopTest();

        System.assertNotEquals(null, result, 'Matrix data should not be null');
        System.assert(result.containsKey('clients'), 'Clients key should exist in matrix data');
        System.assert(result.containsKey('products'), 'Products key should exist in matrix data');
    }

    @isTest
    static void testGetCircuitPicklistValues() {
        Test.startTest();
        List<Map<String, String>> result = CTRL018_RelevDePrixController.getCircuitPicklistValues();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Circuit picklist values should not be null');
        System.assert(result.size() > 0, 'Circuit picklist values should contain entries');
    }

    @isTest
    static void testGetRegionPicklistValue() {
        Test.startTest();
        List<Map<String, String>> result = CTRL018_RelevDePrixController.getRegionPicklistValue();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Region picklist values should not be null');
        System.assert(result.size() > 0, 'Region picklist values should contain entries');
    }

    @isTest
    static void testIsInputEnabled() {
         // Test Case 1: Valid profile and matching region
        User testUser = [SELECT Id FROM User WHERE Alias = 'testuser' LIMIT 1];
        System.runAs(testUser) {
            Test.startTest();
            Boolean result = CTRL018_RelevDePrixController.isInputEnabled('A02');
            Test.stopTest();
            System.assertEquals(true, result, 'Input should be enabled for a valid profile and matching region.');
        }

        
    }

    @isTest
    static void testSaveMatrixData() {
        List<Map<String, Object>> updates = new List<Map<String, Object>>{
            new Map<String, Object>{
                'id' => null,
                'price' => 200.0,
                'year'=>'2024',
                'month'=>'12',
                'region' => 'A02',
                'circuit' => 'Traditionnel',
                'client' => 'Détaillant',
                'product' => 'Pain'
            }
        };

        Test.startTest();
        CTRL018_RelevDePrixController.saveMatrixData(updates);
        Test.stopTest();

        List<Relev_de_prix__c> records = [
            SELECT Id, Prix__c
            FROM Relev_de_prix__c
            WHERE Circuit_de_client__c = 'Traditionnel'
        ];
        System.assertEquals(3, records.size(), 'A new record should have been created');
        System.assertEquals(200.0, records[2].Prix__c, 'The price of the new record should match the updated value');
    }
}