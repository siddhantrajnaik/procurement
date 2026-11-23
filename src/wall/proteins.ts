// "Protein of the day": famous structures from the Protein Data Bank, one per day in this order, with a short line
// on why each matters. The id is the PDB entry; its title, method and resolution are read live from RCSB.
export interface Famous { id: string; name: string; fact: string }

export const FAMOUS: Famous[] = [
  { id: '1MBN', name: 'Myoglobin', fact: 'The first protein structure ever solved, from sperm whale muscle, by John Kendrew.' },
  { id: '4HHB', name: 'Hemoglobin', fact: 'Carries oxygen in red blood cells. Four subunits that pass the message along.' },
  { id: '1EMA', name: 'Green fluorescent protein', fact: 'A jellyfish protein that glows green. It became a tool for seeing proteins in living cells.' },
  { id: '4INS', name: 'Insulin', fact: 'The hormone that controls blood sugar, and the first protein to have its sequence read.' },
  { id: '6VXX', name: 'SARS-CoV-2 spike', fact: 'The trimer on the virus surface that grips human cells. A major target for vaccines.' },
  { id: '6M0J', name: 'Spike bound to ACE2', fact: 'The coronavirus spike hooked onto its human receptor, the first step of infection.' },
  { id: '6LU7', name: 'SARS-CoV-2 main protease', fact: 'The scissors that cut the virus polyprotein into working pieces. A drug target.' },
  { id: '1HSG', name: 'HIV-1 protease', fact: 'An HIV enzyme blocked by protease-inhibitor drugs, shown here with indinavir.' },
  { id: '1RUZ', name: '1918 influenza hemagglutinin', fact: 'The surface protein of the 1918 pandemic flu, rebuilt from the virus itself.' },
  { id: '1LYZ', name: 'Lysozyme', fact: 'Found in tears and egg white. One of the first enzymes whose structure was solved.' },
  { id: '1UBQ', name: 'Ubiquitin', fact: 'A 76-residue tag that marks proteins for recycling. Almost identical in all animals.' },
  { id: '1CRN', name: 'Crambin', fact: 'A tiny plant protein so well ordered that it was solved at near-atomic detail early on.' },
  { id: '1AON', name: 'GroEL and GroES', fact: 'A barrel-shaped chaperone that gives unfolded proteins a safe space to fold.' },
  { id: '1TUP', name: 'p53 bound to DNA', fact: 'The tumour suppressor that guards the genome, holding on to its DNA target.' },
  { id: '1BL8', name: 'KcsA potassium channel', fact: 'A channel that lets potassium through and keeps sodium out. Nobel Prize 2003.' },
  { id: '1F88', name: 'Rhodopsin', fact: 'The light sensor in the eye, and the first GPCR structure ever determined.' },
  { id: '2RH1', name: 'Beta-2 adrenergic receptor', fact: 'A GPCR that responds to adrenaline. Its structure helped earn the 2012 Nobel Prize.' },
  { id: '1STP', name: 'Streptavidin with biotin', fact: 'One of the strongest bonds in biology, widely used to catch and label molecules.' },
  { id: '2LZM', name: 'T4 lysozyme', fact: 'A phage enzyme used for decades to study how proteins fold and stay stable.' },
  { id: '1QYS', name: 'Top7', fact: 'A protein designed from scratch by David Baker, with a fold not seen in nature.' },
  { id: '3CLN', name: 'Calmodulin', fact: 'A calcium sensor in nearly every cell, shaped like a dumbbell.' },
  { id: '1AKE', name: 'Adenylate kinase', fact: 'An enzyme that opens and closes like a clamp while it works.' },
  { id: '1BNA', name: 'B-DNA', fact: 'The double helix itself: a 12-base-pair stretch of DNA seen at atomic detail.' },
  { id: '1TIM', name: 'Triosephosphate isomerase', fact: 'The classic TIM barrel, a fold found in hundreds of enzymes.' },
  { id: '1PGA', name: 'Protein G domain', fact: 'A small, stable domain that biochemists use as a model for protein folding.' },
  { id: '1HVR', name: 'HIV-1 protease with inhibitor', fact: 'Another view of the HIV protease, this time clamped around a drug candidate.' },
];
