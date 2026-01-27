# Experiment 1 - Analog Keyboard Level test

This folder contains a standalone pressure level experiment for Wooting analog keyboards.

## How to Use

### 1. Start server in python bash

```bash
# Option 1: Use a local web server
python app.py
# Then visit http://localhost:1111/typing

```

### 2. Select Training or Experiment

#### Training interface

##### Connect Your Keyboard
1. Click the **"Connect!"** button
2. Select your Wooting keyboard from the browser's HID device dialog
3. Device name and Product ID should appear once connected

##### Select level mode
1. This will used to show the feedback after user pressing everykey


##### Practice typing in different level
1. The key would change colour based on the pressing value
2. After key up, the feedback will show the recognised level mode.



#### Experient interface
1. Insert participant ID and press start

##### Connect Your Keyboard
1. Click the **"Connect!"** button
2. Select your Wooting keyboard from the browser's HID device dialog
3. Device name and Product ID should appear once connected
4. Need to connect device every block
5. Don't forget to click mouse anywhere to unfocus the button (interfere with the space key)

##### Press Space key to start the experiment
1. The level mode and block information will show on the left
2. Ask participant to put their 8 fingers on the home row, and ask them not to change finger to type. 
3. Once participant is ready, press space key to start the experiment
4. Trial information will show on top of the keyboard
5. Task will show on the top, include key and level
6. Target key will change color based on the target level: 
   - **light yellow**: "light"
   - **yellow**: "medium" or "mediumLow"
   - **orange**: "mediumHigh"
   - **dark red**: "full"
7. Ask participant to press the key as fast and accurate as possible
8. The first block is practice block. In the end of each block, the webpage will refrash, reload the study interface to go back to the previous page (End of the study)
9. Need to connect device every block
10. Don't forget to click mouse anywhere to unfocus the button (interfere with the space key)

##### End of the study
1. The result will show in the results folder, with file name "id.csv"