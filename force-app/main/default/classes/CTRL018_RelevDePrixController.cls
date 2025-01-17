public without sharing class CTRL018_RelevDePrixController {
    
    @AuraEnabled(cacheable=true)
    public static String getUserRegion() {
        // Fetch the connected user's Region__c field
        User currentUser = [
            SELECT Agence_commerciale__c
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];
        // Get all picklist values for Region__c and map API names to labels
        Map<String, String> regionApiToLabelMap = new Map<String, String>();
        Schema.DescribeFieldResult fieldDescribe = Schema.SObjectType.User.fields.getMap().get('Agence_commerciale__c').getDescribe();
        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            regionApiToLabelMap.put(entry.getValue(), entry.getLabel());
        }
        
        // Get the label for the current user's region
        String regionApiName = currentUser.Agence_commerciale__c;
        String regionLabel = regionApiToLabelMap.containsKey(regionApiName) ? regionApiToLabelMap.get(regionApiName) : null;

        return regionLabel;
    }


    @AuraEnabled
    public static Map<String, Object> getMatrixData(Decimal selectedYear, String selectedMonth, String selectedCircuit, String selectedRegion,String selectedSousRegion,String selectedMilieu) {
        Map<String, Object> result = new Map<String, Object>();

        // Debugging the selected year, month, circuit and region
        System.debug('selectedYear: ' + selectedYear);
        System.debug('selectedMonth: ' + selectedMonth);
        System.debug('selectedCircuit: ' + selectedCircuit);
        System.debug('selectedRegion: ' + selectedRegion);
        system.debug('selectedSousRegion'+selectedSousRegion);

        // Return only the provided Circuit value in the response
        List<Map<String, String>> circuitPicklistValues = new List<Map<String, String>>();
        circuitPicklistValues.add(new Map<String, String>{
            'label' => selectedCircuit,
            'value' => selectedCircuit
        });


        // Fetch picklist values for Type_de_client__c
        List<Map<String, String>> clientPicklistValues = getDependentClientPicklistValues(selectedCircuit);

        // Fetch picklist values for Type_de_produit__c
        List<Map<String, String>> productPicklistValues = getPicklistValues('Relev_de_prix__c', 'Type_de_produit__c');

        // Build the matrix for existing records
        Map<String, Map<String, Object>> productPrices = new Map<String, Map<String, Object>>();
        List<Relev_de_prix__c> records = [
            SELECT Id, Type_de_produit__c, Type_de_client__c, Prix__c, Circuit_de_client__c, R_gion__c, Annee__c, Mois__c,Sous_r_gion__c,Milieu__c
            FROM Relev_de_prix__c
            WHERE Annee__c = : selectedYear AND Mois__c = : selectedMonth AND Circuit_de_client__c = :selectedCircuit AND R_gion__c = :selectedRegion AND Sous_r_gion__c = :selectedSousRegion AND Milieu__c = :selectedMilieu
        ];

        for (Relev_de_prix__c record : records) {
            String key = String.valueOf(record.Annee__c) + '_'+record.Mois__c + '_' + record.R_gion__c + '_' + record.Circuit_de_client__c + '_' + record.Type_de_client__c+ '_' + record.Sous_r_gion__c+ '_' + record.Milieu__c;

            if (!productPrices.containsKey(record.Type_de_produit__c)) {
                productPrices.put(record.Type_de_produit__c, new Map<String, Object>());
            }

            productPrices.get(record.Type_de_produit__c).put(key, new Map<String, Object>{
                'id' => record.Id,
                'price' => record.Prix__c
            });
        }

        result.put('circuits', circuitPicklistValues);
        result.put('clients', clientPicklistValues);
        result.put('products', productPicklistValues);
        result.put('matrix', productPrices);
        system.debug('Result : '+result);
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getMonthPicklistValues() {
        return getPicklistValues('Relev_de_prix__c', 'Mois__c');
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getCircuitPicklistValues() {
        return getPicklistValues('Relev_de_prix__c', 'Circuit_de_client__c');
    }

    

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getRegionPicklistValue() {
        return getPicklistValues('Relev_de_prix__c', 'R_gion__c');
    }

    @AuraEnabled(cacheable=true)
    public static Boolean isInputEnabled(String selectedRegion) {
        String currentProfileName = [SELECT Profile.Name, Agence_commerciale__c FROM User WHERE Id = :UserInfo.getUserId()].Profile.Name;
        String userRegion = [SELECT Agence_commerciale__c FROM User WHERE Id = :UserInfo.getUserId()].Agence_commerciale__c;

        System.debug('Region : '+userRegion);
        system.debug('selectedRegion'+selectedRegion);

        // Query custom metadata for profile access control
        List<ProfileAccessControl__mdt> profileAccessList = [
            SELECT ProfileName__c, IsEnabled__c
            FROM ProfileAccessControl__mdt
            WHERE ProfileName__c = :currentProfileName
        ];
        if(currentProfileName == 'System Administrator') return true;
        // Check if the profile exists in custom metadata and return the appropriate value
        if (!profileAccessList.isEmpty()) {
            return profileAccessList[0].IsEnabled__c;
        }

        // Default to false if no matching record found
        return false;
    }

    public static List<Map<String, String>> getPicklistValues(String objectName, String fieldName) {
        List<Map<String, String>> picklistValues = new List<Map<String, String>>();

        Schema.DescribeSObjectResult objDescribe = Schema.getGlobalDescribe().get(objectName).getDescribe();
        Schema.DescribeFieldResult fieldDescribe = objDescribe.fields.getMap().get(fieldName).getDescribe();

        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            picklistValues.add(new Map<String, String>{
                'label' => entry.getLabel(),
                'value' => entry.getValue()
            });
        }
        return picklistValues;
    }

    private static List<Map<String, String>> getDependentClientPicklistValues(String selectedCircuit) {
        List<Map<String, String>> dependentValues = new List<Map<String, String>>();

        List<CircuitTypeClientMapping__mdt> mappings = [
            SELECT Circuit_de_client__c, Type_de_client__c,Ordre_d_affichage__c
            FROM CircuitTypeClientMapping__mdt
            WHERE Circuit_de_client__c = :selectedCircuit Order By Ordre_d_affichage__c ASC
        ];

        for (CircuitTypeClientMapping__mdt mapping : mappings) {
            dependentValues.add(new Map<String, String>{
                'label' => mapping.Type_de_client__c,
                'value' => mapping.Type_de_client__c
            });
        }

        return dependentValues;
    }

    @AuraEnabled
    public static void saveMatrixData(List<Map<String, Object>> updates) {
        // Create lists for records to update and create
        List<Relev_de_prix__c> recordsToUpdate = new List<Relev_de_prix__c>();
        List<Relev_de_prix__c> recordsToCreate = new List<Relev_de_prix__c>();

        

        // Process the incoming updates
        for (Map<String, Object> updatess : updates) {
            if (updatess == null) {
                System.debug('Skipping null update.');
                continue;
            }

            String id = (String) updatess.get('id');
            Decimal price = (Decimal) updatess.get('price');
            String month = (String) updatess.get('month');
            Integer year = Integer.valueOf((String) updatess.get('year'));
            String region = (String) updatess.get('region');
            String circuit = (String) updatess.get('circuit');
            String client = (String) updatess.get('client');
            String product = (String) updatess.get('product');
            String sousRegion = (String) updatess.get('sousRegion');
            String milieu =(String) updatess.get('milieu');
            // Ensure all necessary fields are present
            if (price == null || month == null || region == null || circuit == null || client == null || product == null) {
                System.debug('Skipping record due to missing data: ' + updatess);
                continue;
            }

            // Replace API name of region with its label
            String regionLabel = region;


            if (id != null) {
                // Update existing record
                recordsToUpdate.add(new Relev_de_prix__c(
                    Id = id,
                    Prix__c = price,
                    Annee__c = year
                ));
            } else {
                // Create new record
                String recordName = regionLabel + '-' + circuit + '-' + client + '-' + product;
                if(recordName.length() > 247) recordName = recordName.substring(0, 247);
                recordName += '-' + month + '/' + year;
                recordsToCreate.add(new Relev_de_prix__c(
                    Name = recordName,
                    Mois__c = month,
                    R_gion__c = region,
                    Annee__c = year,
                    Circuit_de_client__c = circuit,
                    Type_de_client__c = client,
                    Type_de_produit__c = product,
                    Prix__c = price,
                    Sous_r_gion__c = sousRegion,
                    milieu__c = milieu
                ));
            }
        }

        // Perform DML operations
        if (!recordsToUpdate.isEmpty()) {
            try {
                update recordsToUpdate;
            } catch (Exception e) {
                System.debug('Error updating records: ' + e.getMessage());
                throw new AuraHandledException('Failed to update records: ' + e.getMessage());
            }
        }

        if (!recordsToCreate.isEmpty()) {
            try {
                insert recordsToCreate;
            } catch (Exception e) {
                System.debug('Error creating records: ' + e.getMessage());
                throw new AuraHandledException('Failed to create records: ' + e.getMessage());
            }
        }

        System.debug('Records updated: ' + recordsToUpdate);
        System.debug('Records created: ' + recordsToCreate);
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getMilieuPicklistValues() {
        return getPicklistValues('Relev_de_prix__c', 'Milieu__c');
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getSousRegionPicklistValues(String selectedRegion) {
        List<Map<String, String>> sousRegionValues = new List<Map<String, String>>();
            system.debug('heeeeelllloooo'+selectedRegion);
        List<RegionSousRegionMapping__mdt> mappings = [
            SELECT R_gion__c, Sous_r_gion__c
            FROM RegionSousRegionMapping__mdt
            WHERE R_gion__c = :selectedRegion
        ];

        for (RegionSousRegionMapping__mdt mapping : mappings) {
            sousRegionValues.add(new Map<String, String>{
                'label' => mapping.Sous_r_gion__c,
                'value' => mapping.Sous_r_gion__c
            });
        }

        return sousRegionValues;
    }


}