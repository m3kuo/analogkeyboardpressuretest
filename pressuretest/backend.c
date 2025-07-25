#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <wooting-analog-sdk.h>

#define PORT 8765
#define BUFFER_SIZE 1024

int main() {
    // Initialize Wooting Analog SDK
    if (!wooting_analog_initialise()) {
        fprintf(stderr, "Failed to initialize Wooting Analog SDK\n");
        return 1;
    }

    // Create socket
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == 0) {
        fprintf(stderr, "Socket creation failed\n");
        return 1;
    }

    // Set socket options
    int opt = 1;
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
        fprintf(stderr, "Setsockopt failed\n");
        return 1;
    }

    // Bind socket
    struct sockaddr_in address;
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(PORT);

    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        fprintf(stderr, "Bind failed\n");
        return 1;
    }

    // Listen for connections
    if (listen(server_fd, 3) < 0) {
        fprintf(stderr, "Listen failed\n");
        return 1;
    }

    printf("C program listening on port %d\n", PORT);

    int new_socket;
    int addrlen = sizeof(address);
    if ((new_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) < 0) {
        fprintf(stderr, "Accept failed\n");
        return 1;
    }

    printf("Python backend connected\n");

    // Main loop: read analog data and send to Python backend
    while (1) {
        // Read analog data for all keys
        char buffer[BUFFER_SIZE];
        int offset = 0;
        
        // Get analog values for all keys (assuming 104 keys for full keyboard)
        for (int key = 0; key < 104; key++) {
            float analog_value = wooting_analog_read_analog(key);
            if (analog_value > 0.0f) {  // Only send keys with pressure
                int written = snprintf(buffer + offset, BUFFER_SIZE - offset, 
                                     "%d:%.3f,", key, analog_value);
                offset += written;
            }
        }

        if (offset > 0) {
            // Remove trailing comma and add newline
            if (offset > 0 && buffer[offset-1] == ',') {
                buffer[offset-1] = '\n';
                buffer[offset] = '\0';
            }
            
            // Send data to Python backend
            send(new_socket, buffer, strlen(buffer), 0);
        }

        usleep(10000);  // 10ms delay (100Hz update rate)
    }

    close(new_socket);
    close(server_fd);
    wooting_analog_uninitialise();
    return 0;
}
