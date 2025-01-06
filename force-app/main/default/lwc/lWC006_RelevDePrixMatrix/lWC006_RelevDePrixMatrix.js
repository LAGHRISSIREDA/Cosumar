import { LightningElement, track } from 'lwc';

import getMonthPicklistValues from '@salesforce/apex/CTRL018_RelevDePrixController.getMonthPicklistValues';
import getRegionPicklistValue from '@salesforce/apex/CTRL018_RelevDePrixController.getRegionPicklistValue';
import getCircuitPicklistValues from '@salesforce/apex/CTRL018_RelevDePrixController.getCircuitPicklistValues';

import getMatrixData from '@salesforce/apex/CTRL018_RelevDePrixController.getMatrixData';
import saveMatrixData from '@salesforce/apex/CTRL018_RelevDePrixController.saveMatrixData';
import getSousRegionPicklistValues from '@salesforce/apex/CTRL018_RelevDePrixController.getSousRegionPicklistValues';
import getMilieuPicklistValues from '@salesforce/apex/CTRL018_RelevDePrixController.getMilieuPicklistValues';
import isInputEnabled from '@salesforce/apex/CTRL018_RelevDePrixController.isInputEnabled';
import getUserRegion from '@salesforce/apex/CTRL018_RelevDePrixController.getUserRegion';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadStyle } from 'lightning/platformResourceLoader';
import { refreshApex } from "@salesforce/apex";

import LOGO from '@salesforce/resourceUrl/Logo'; 
import RELEVE_DE_PRIX from '@salesforce/resourceUrl/ReleveDePrix';

export default class LWC006_RelevDePrixMatrix extends LightningElement {
    @track isDisabled = true;
    @track isLoading = false;
    logoUrl = LOGO;
    @track precomputedData ;

    @track circuitOptions = [];
    @track monthOptions = [];
    @track regionOptions = [];
    @track yearOptions = [];
    @track selectedYear = '';
    @track yearError = ''; 
    @track milieuOptions = [];
    @track selectedMilieu = '';
    
    @track selectedMonth = '';
    @track selectedCircuit = '';
    @track selectedRegion = '';
    @track sousRegionOptions = [];
    @track selectedSousRegion = '';

    @track matrixData = {
        months: [],
        circuits: [],
        clients: [],
        products: [],
        matrix: {}
    };
    updatedPrices = {};

    connectedCallback() {
        this.generateYearOptions();
         Promise.resolve().then(() => {
            this.selectedYear = String(new Date().getFullYear());
            console.log('Selected Year (Default):', this.selectedYear);
        });
        this.loadRegionOptions();
        this.loadMilieuOptions();
        this.loadMonthOptions();
        
        this.loadStyles();
    }

   loadSousRegionOptions() {
    return new Promise((resolve, reject) => {
        if (this.selectedRegion) {
            getSousRegionPicklistValues({ selectedRegion: this.selectedRegion })
                .then((data) => {
                    this.sousRegionOptions = data;
                    this.selectedSousRegion = data.length > 0 ? data[0].value : '';
                    console.log('Updated Sous Region:', this.selectedSousRegion);
                    resolve(); // Resolve the promise
                })
                .catch((error) => {
                    console.error('Error fetching Sous Region picklist values:', error);
                    reject(error); // Reject the promise
                });
        } else {
            this.sousRegionOptions = [];
            this.selectedSousRegion = '';
            resolve(); // Resolve immediately if no region is selected
        }
    });
}

handleSousRegionChange(event) {
    this.selectedSousRegion = event.target.value;

    console.log('Selected Sous Region:', this.selectedSousRegion);

    // Refresh the matrix data based on the new sous region
    this.loadMatrixData();
}

loadMilieuOptions() {
    getMilieuPicklistValues()
        .then((data) => {
            this.milieuOptions = data;
            this.selectedMilieu = data.length > 0 ? data[0].value : '';
        })
        .catch((error) => {
            console.error('Error fetching Milieu picklist values:', error);
        });
}

handleMilieuChange(event) {
    this.selectedMilieu = event.target.value;
    this.loadMatrixData();
}




handleRegionChange(event) {
    this.selectedRegion = event.target.value;
    this.loadSousRegionOptions();
    
    this.checkProfile();
    this.loadMatrixData();
}

    get comboboxOptions() {
        return this.yearOptions;
    }

    async checkProfile() {
        try {
            const isEnabled = await isInputEnabled();
            this.isDisabled = !isEnabled;
        } catch (error) {
            console.error('Error checking profile status:', error);
        }
    }

    loadStyles() {
        loadStyle(this, RELEVE_DE_PRIX)
            .then(() => {
               // console.log('Styles loaded successfully.');
            })
            .catch((error) => {
                console.error('Error loading styles:', error);
            });
    }

    get hasClients() {
        return this.matrixData.clients && this.matrixData.clients.length > 0;
    }

   loadMonthOptions() {
    
    this.selectedYear = new Date().getFullYear();

    
    getMonthPicklistValues()
        .then((data) => {
            
            this.monthOptions = data.map(option => ({
                label: option.label,
                value: String(option.value), 
            }));

           
            const currentMonth = String(new Date().getMonth() + 1);

            const currentMonthOption = this.monthOptions.find(option => option.value === currentMonth);

          
            if (currentMonthOption) {
                this.selectedMonth = currentMonth;
            } else {
              
                this.selectedMonth = this.monthOptions[0].value;
            }

           
            
            
        })
        .catch((error) => {
            console.error('Error fetching Month picklist values:', error);
        });
}



    loadRegionOptions() {
    Promise.all([getRegionPicklistValue(), getUserRegion()])
        .then(([regions, userRegion]) => {
            // Assign the fetched regions to regionOptions
            this.regionOptions = regions;

            // Find the user region by matching its label or value, considering case insensitivity
            const matchedRegion = regions.find(region => 
                region.value.toLowerCase() === userRegion.toLowerCase()
            );

            // If a match is found, set it as selectedRegion; otherwise, default to the first region
            this.selectedRegion = matchedRegion ? matchedRegion.value : (regions.length > 0 ? regions[0].value : '');

            console.log('User Region:', userRegion);
            console.log('Regions:', regions);
            console.log('Selected Region:', this.selectedRegion);

            // Load dependent options and data
            this.loadSousRegionOptions();
            this.loadCircuitOptions();
            this.checkProfile();
        })
        .catch((error) => {
            console.error('Error fetching region picklist values:', error);
        });
}


    loadCircuitOptions() {
        getCircuitPicklistValues()
            .then((data) => {
                this.circuitOptions = data;
                if (data.length > 0) {
                    this.selectedCircuit = data[0].value;
                    this.loadMatrixData();
                }
            })
            .catch((error) => {
                console.error('Error fetching Circuit picklist values:', error);
            });
    }

    loadMatrixData() {
        // Clear current data to ensure a refresh
        this.matrixData = {
            months: [],
            circuits: [],
            clients: [],
            products: [],
            matrix: {}
        };
        this.precomputedData = []; // Clear precomputed data
        this.isLoading = true;

        getMatrixData({ 
            selectedYear: this.selectedYear,
            selectedMonth: this.selectedMonth,
            selectedCircuit: this.selectedCircuit, 
            selectedRegion: this.selectedRegion ,
            selectedSousRegion : this.selectedSousRegion,
            selectedMilieu: this.selectedMilieu
        })
        .then((data) => {
            // Update state
            console.log('Selected sous region ',this.selectedSousRegion)
            this.matrixData = data;
            
            this.precomputeData();
            
            this.isLoading = false;
        })
        .catch((error) => {
            console.error('Error fetching matrix data:', error);
            this.showToast('Erreur', 'Échec de chargement des données. Veuillez réessayer.', 'error');
            this.isLoading = false;
        });
    }


    precomputeData() {
        console.log('fffff',this.selectedSousRegion)
        this.precomputedData = this.matrixData.products.map((product) => {
            return {
                productLabel: product.label,
                productValue: product.value,
                rows: this.matrixData.circuits.map((circuit) => {
                    return {
                        circuitLabel: circuit.label,
                        circuitValue: circuit.value,
                        cells: this.matrixData.clients.map((client) => {
                            const key = `${this.selectedYear}_${this.selectedMonth}_${this.selectedRegion}_${circuit.value}_${client.value}_${this.selectedSousRegion}_${this.selectedMilieu}`;
                            //console.log('key matrix',key);
                            const price = this.matrixData.matrix[product.value]?.[key]?.price;
                            const displayPrice = price !== undefined && price !== null && price !== 0 ? price : '';
                            const style = price == undefined || price == null || price == 0 ? 'color: rgb(31 63 132 / 67%);' : 'color: rgb(0 128 255);font-weight: 600;';
                            return {
                                clientLabel: client.label,
                                clientValue: client.value,
                                price: displayPrice,
                                hintText: displayPrice,
                                style : style
                            };
                        })
                    };
                })
            };
        });
    }

     // Generate year options
    generateYearOptions() {
        const currentYear = new Date().getFullYear(); 
        const startYear = currentYear-5;
        const endYear = currentYear+1;
        
        this.yearOptions = [];
        for (let year = startYear; year <= endYear; year++) {
            this.yearOptions.push({
                label: String(year), 
                value: String(year)  
            });
        }
    }

    // Handle year selection change
    handleYearChange(event) {
        this.selectedYear = event.detail.value;
        console.log('Selected Year (Updated):', this.selectedYear);

        // Call dependent methods
        this.checkProfile();
        this.loadMatrixData();
    }

    handleMonthChange(event) {
        this.selectedMonth = event.target.value;
        console.log('this.selectedMonth',this.selectedMonth)
        this.checkProfile();
        this.loadMatrixData();
    }

    handleRegionChange(event) {
        this.selectedRegion = event.target.value;
         this.checkProfile();
        this.loadSousRegionOptions()
        .then(() => {
           
            this.loadMatrixData();
        })
        .catch((error) => {
            console.error('Error handling region change:', error);
        });
    }

    handleCircuitChange(event) {
        this.selectedCircuit = event.target.value;
        this.loadMatrixData();
    }

    handlePriceChange(event) {
        const product = event.target.dataset.product;
        const circuit = event.target.dataset.circuit;
        const client = event.target.dataset.client;
        const newValue = parseFloat(event.target.value);
        

        if (!this.updatedPrices[product]) {
            this.updatedPrices[product] = {};
        }

       // String key = String.valueOf(record.Annee__c) + '_'+record.Mois__c + '_' + record.Agence__c + '_' + record.Circuit_de_client__c + '_' + record.Type_de_client__c;

        const key = `${this.selectedYear}_${this.selectedMonth}_${this.selectedRegion}_${circuit}_${client}_${this.selectedSousRegion}_${this.selectedMilieu}`;
        console.log('key :',key)
        this.updatedPrices[product][key] = {
            price: newValue,
            id: this.matrixData.matrix[product]?.[key]?.id || null
        };
    }

    handleSave() {
        if (!this.isDisabled) {
            //this.isLoading = true;
            const flattenedUpdates = [];
            for (const product in this.updatedPrices) {
                for (const key in this.updatedPrices[product]) {
                    const cell = this.updatedPrices[product][key];

                    if (isNaN(cell.price)) {
                        cell.price = 0;
                    }
                    if (cell.price !== undefined && cell.price>=0) {
                        this.isLoading = true;
                        const [year, month, region, circuit, client,sousRegion,milieu] = key.split('_');
                        flattenedUpdates.push({
                            id: cell.id || null,
                            price: cell.price || 0,
                            year: year,
                            month: month,
                            region: region,
                            circuit: circuit,
                            client: client,
                            product: product,
                            sousRegion:sousRegion,
                            milieu:milieu
                        });
                        
                    }else{
                        this.showToast('Erreur', 'Veuillez entrer une valeur positive pour le prix.', 'error');                      
                        return;
                    }
                }
                console.log('flattenedUpdates',flattenedUpdates);
            }

            saveMatrixData({ updates: flattenedUpdates })
                .then(() => {
                this.showToast('Succès', 'Les prix ont été mis à jour avec succès.', 'success');
                this.updatedPrices = {}; 
                
            })
            .then(() => {
                this.isLoading = false; 
            })
            .catch((error) => {
                this.showToast('Erreur', 'Échec de la mise à jour des prix. Veuillez réessayer.', 'error');
                console.error('Error saving prices:', error);
                this.isLoading = false; 
            });
        }
    }

   

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}