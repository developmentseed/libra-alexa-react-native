import React, { Component } from 'react';
import {
  Dimensions,
  StyleSheet,
  View,
  Platform,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import PropTypes from 'prop-types';

import { AudioRecorder, AudioUtils } from 'react-native-audio';

import MicrophoneIcon from './components/MicrophoneIcon';
import CircleRadialGradient from './components/CircleRadialGradient';

import { geocodeCityInput } from './services/geocoding';
import { sendAudioToLex } from './services/lex';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const colorWhite = '#fff';
const colorBlack = '#000';
const micInactiveShadow = '#4AE2D6';
const recordIconBg = 'red';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorBlack,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radialBgContainer: {
    position: 'absolute',
    top: (screenHeight - screenWidth) / 2,
    left: 0,
  },
  buttonContainer: {
    backgroundColor: colorWhite,
    borderRadius: 65,
    width: 130,
    height: 130,
    alignItems: 'center',
    elevation: 1,
    padding: 15,
    shadowOffset: { width: 0, height: 0 },
    shadowColor: micInactiveShadow,
    shadowOpacity: 1,
  },
  recordIcon: {
    backgroundColor: recordIconBg,
    width: 50,
    height: 50,
    borderRadius: 25,
    marginTop: 25,
  },
  statusMessage: {
    position: 'absolute',
    bottom: 40,
    color: colorWhite,
    fontSize: 18,
  },
});

export default class HomeScreen extends Component {
  static navigationOptions = {
    header: null,
  };

  constructor(props) {
    super(props);

    this.state = {
      isAuthorized: false,
      isRecording: false,
      buttonShadowRadius: new Animated.Value(31),
    };
  }

  componentDidMount() {
    AudioRecorder.requestAuthorization().then((isAuthorized) => {
      this.setState({ isAuthorized });
    });

    this.prepareRecordingAnimation();
    this.prepareRecorder();
  }

  onAudioRecordingFinished = async (data) => {
    // Android callback comes in the form of a promise instead.
    if (Platform.OS === 'ios') {
      this.finishRecording(data.audioFileURL);
    }

    const { isRecording } = this.state;

    if (!isRecording && data.base64) {
      let feature;
      let lexResponse;

      try {
        lexResponse = await sendAudioToLex(data);
        console.log(lexResponse);

        if (lexResponse.dialogState === 'ElicitIntent' || !lexResponse.slots) {
          this.setStatusMessage(lexResponse.message);
          return;
        }

        const geoResponse = await geocodeCityInput(lexResponse.slots.City);
        // const geoResponse = await geocodeCityInput('San Francisco');
        [feature] = geoResponse.body.features;
      } catch (err) {
        console.error(err);
      }

      this.showMapView(feature, lexResponse.slots);
      // this.showMapView(feature, {
      //   CloudPercentage: 0,
      // });
    }
  }

  setStatusMessage(message) {
    this.setState({
      statusMessage: message,
    });
  }

  finishRecording(filePath) {
    this.setState({
      isRecording: false,
    });
    console.log(`Finished recording at path: ${filePath}`);
  }

  prepareRecorder() {
    const audioPath = `${AudioUtils.DocumentDirectoryPath}/test2.lpcm`;
    AudioRecorder.prepareRecordingAtPath(audioPath, {
      SampleRate: 8000,
      Channels: 1,
      AudioQuality: 'High',
      AudioEncoding: 'lpcm',
      IncludeBase64: true,
    });

    AudioRecorder.onFinished = this.onAudioRecordingFinished;
  }

  prepareRecordingAnimation() {
    const { buttonShadowRadius } = this.state;

    const animatedShadowFrames = [5, 10, 15, 8, 12, 18, 10, 7];
    const animations = animatedShadowFrames.map(radiusValue => Animated.timing(
      buttonShadowRadius,
      {
        toValue: radiusValue,
        duration: 200,
        useNativeDriver: true,
      },
    ));

    this.recordingAnimation = Animated.loop(Animated.sequence(animations));
  }

  showMapView(feature, lexSlotValues) {
    if (!feature) {
      // Show a message that location could not be found?
      return;
    }

    const { navigation } = this.props;

    navigation.push('Map', {
      centerCoords: feature.geometry.coordinates,
      lexSlotValues,
    });
  }

  async startRecording() {
    const { isAuthorized } = this.state;
    if (!isAuthorized) {
      return;
    }

    this.recordingAnimation.start();

    this.setState({
      isRecording: true,
      statusMessage: null,
    });

    // try {
    //   await AudioRecorder.startRecording();
    // } catch (error) {
    //   console.error(error);
    // }
  }

  async stopRecording() {
    this.recordingAnimation.stop();
    this.recordingAnimation.reset();
    this.finishRecording();
    // try {
    //   const filePath = await AudioRecorder.stopRecording();

    //   if (Platform.OS === 'android') {
    //     this.finishRecording(filePath);
    //   }
    // } catch (error) {
    //   console.error(error);
    // }
  }

  render() {
    const { buttonShadowRadius, isRecording, statusMessage } = this.state;

    return (
      <View style={styles.container}>
        <View style={styles.radialBgContainer}>
          <CircleRadialGradient
            width={screenWidth}
            height={screenWidth}
          />
        </View>
        <TouchableOpacity
          onPress={() => {
            if (isRecording) {
              this.stopRecording();
            } else {
              this.startRecording();
            }
          }}
        >
          <Animated.View
            style={[styles.buttonContainer, {
              shadowRadius: buttonShadowRadius,
            }]}
          >
            <MicrophoneIcon width={60} height={100} />
          </Animated.View>
        </TouchableOpacity>
        { statusMessage && (
          <Text style={styles.statusMessage}>{ statusMessage }</Text>
        )}
      </View>
    );
  }
}

HomeScreen.propTypes = {
  navigation: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};
