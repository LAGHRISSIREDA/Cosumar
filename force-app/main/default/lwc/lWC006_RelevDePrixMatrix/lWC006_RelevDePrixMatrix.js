import { LightningElement, track } from 'lwc';

import getMonthPicklistValues from '@salesforce/apex/CTRL018_RelevDePrixController.getMonthPicklistValues';
import getRegionPicklistValue from '@salesforce/apex/CTRL018_RelevDePrixController.getRegionPicklistValue';
import getCircuitPicklistValues from '@salesforce/apex/CTRL018_RelevDePrixController.getCircuitPicklistValues';
import getMatrixData from '@salesforce/apex/CTRL018_RelevDePrixController.getMatrixData';
import saveMatrixData from '@salesforce/apex/CTRL018_RelevDePrixController.saveMatrixData';
import getUserRegion from '@salesforce/apex/CTRL018_RelevDePrixController.getUserRegion';
import isInputEnabled from '@salesforce/apex/CTRL018_RelevDePrixController.isInputEnabled';

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
    
    @track selectedMonth = '';
    @track selectedCircuit = '';
    @track selectedRegion = '';

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
        this.loadMonthOptions();
        this.loadStyles();
    }

    get comboboxOptions() {
        return this.yearOptions;
    }

    async checkProfile() {
        try {
            const isEnabled = await isInputEnabled({ selectedRegion: this.selectedRegion });
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

           
            this.loadRegionOptions();
        })
        .catch((error) => {
            console.error('Error fetching Month picklist values:', error);
        });
}



    loadRegionOptions() {
        Promise.all([getRegionPicklistValue(), getUserRegion()])
            .then(([regions, userRegion]) => {
                this.regionOptions = regions;
                this.selectedRegion = userRegion || (regions.length > 0 ? regions[0].value : '');      
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
            selectedRegion: this.selectedRegion 
        })
        .then((data) => {
            // Update state
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
        this.precomputedData = this.matrixData.products.map((product) => {
            return {
                productLabel: product.label,
                productValue: product.value,
                rows: this.matrixData.circuits.map((circuit) => {
                    return {
                        circuitLabel: circuit.label,
                        circuitValue: circuit.value,
                        cells: this.matrixData.clients.map((client) => {
                            const key = `${this.selectedYear}_${this.selectedMonth}_${this.selectedRegion}_${circuit.value}_${client.value}`;
                            console.log('key matrix',key);
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
        this.loadMatrixData();
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

        const key = `${this.selectedYear}_${this.selectedMonth}_${this.selectedRegion}_${circuit}_${client}`;
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
                        const [year, month, region, circuit, client] = key.split('_');
                        flattenedUpdates.push({
                            id: cell.id || null,
                            price: cell.price || 0,
                            year: year,
                            month: month,
                            region: region,
                            circuit: circuit,
                            client: client,
                            product: product
                        });
                        
                    }else{
                        this.showToast('Erreur', 'Veuillez entrer une valeur positive pour le prix.', 'error');                      
                        return;
                    }
                }
                
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